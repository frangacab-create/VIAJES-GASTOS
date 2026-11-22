import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { DESTINATIONS, ORIGIN_CORDOBA } from './src/data/destinations.ts';
import type {
  BusOption,
  DailyFareOffer,
  Destination,
  ExchangeRateSnapshot,
  FlightOption,
  FuelPriceEntry,
  FuelType,
  GroundSource,
  LiveTravelData,
  PriceAlert,
  SavingsRecommendation,
  TripType,
} from './src/types/travel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  timestamp: number;
  data: LiveTravelData;
}

const travelCache = new Map<string, CacheEntry>();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('La respuesta del servicio no incluyó un bloque JSON válido.');
  }
  const candidate = withoutFence.slice(firstBrace, lastBrace + 1);
  return JSON.parse(candidate) as Record<string, unknown>;
}

function getCordobaNow(): { dateIso: string; timeStr: string; fullDisplay: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const dateIso = `${get('year')}-${get('month')}-${get('day')}`;
  const rawHour = get('hour');
  const hour = rawHour === '24' ? '00' : rawHour;
  const timeStr = `${hour}:${get('minute')}`;
  return {
    dateIso,
    timeStr,
    fullDisplay: `${dateIso} ${timeStr} ART (Córdoba)`,
  };
}

function normalizeCalendarDays(
  rawDays: unknown,
  defaultAirline: string,
  minDateIso: string
): DailyFareOffer[] {
  if (!Array.isArray(rawDays)) return [];

  const daysEs = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthsEs = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const preliminary: Array<{
    date: string;
    dayOfWeek: string;
    dayNumber: number;
    monthLabel: string;
    cheapestFlightArs: number;
    cheapestAirline: string;
    stops: number;
    busFareArs: number;
    promoNote?: string;
    isWeekend: boolean;
  }> = [];

  const seenDates = new Set<string>();

  for (const item of rawDays) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const dateStr = typeof rec.date === 'string' ? rec.date.trim() : '';
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ||
      dateStr < minDateIso ||
      seenDates.has(dateStr)
    ) {
      continue;
    }

    const flightPrice = Math.round(Number(rec.cheapestFlightArs) || 0);
    const busPrice = Math.round(Number(rec.busFareArs) || 0);
    if (flightPrice <= 0) continue;

    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) continue;

    seenDates.add(dateStr);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 5 || dow === 6;

    preliminary.push({
      date: dateStr,
      dayOfWeek: daysEs[dow],
      dayNumber: d.getDate(),
      monthLabel: monthsEs[d.getMonth()],
      cheapestFlightArs: flightPrice,
      cheapestAirline:
        typeof rec.cheapestAirline === 'string' && rec.cheapestAirline.trim()
          ? rec.cheapestAirline.trim()
          : defaultAirline,
      stops:
        typeof rec.stops === 'number' && rec.stops >= 0
          ? Math.min(2, Math.round(rec.stops))
          : 0,
      busFareArs: busPrice > 0 ? busPrice : 0,
      promoNote:
        typeof rec.promoNote === 'string' && rec.promoNote.trim()
          ? rec.promoNote.trim()
          : undefined,
      isWeekend,
    });
  }

  preliminary.sort((a, b) => a.date.localeCompare(b.date));

  if (preliminary.length === 0) return [];

  const avgFlight =
    preliminary.reduce((acc, item) => acc + item.cheapestFlightArs, 0) /
    preliminary.length;

  return preliminary.map((item) => {
    const ratio = item.cheapestFlightArs / Math.max(1, avgFlight);
    const dealLevel: DailyFareOffer['dealLevel'] =
      ratio <= 0.9 ? 'oferta' : ratio >= 1.1 ? 'alto' : 'normal';
    const savingsVsAvgPercent = Math.round(
      ((avgFlight - item.cheapestFlightArs) / Math.max(1, avgFlight)) * 100
    );
    return {
      ...item,
      dealLevel,
      savingsVsAvgPercent,
    };
  });
}

async function fetchLiveArgentinaRates(): Promise<ExchangeRateSnapshot | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://dolarapi.com/v1/dolares', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const list = (await res.json()) as Array<{
      casa?: string;
      venta?: number;
      fechaActualizacion?: string;
    }>;
    const oficial = list.find((item) => item.casa === 'oficial');
    const tarjeta = list.find((item) => item.casa === 'tarjeta');
    if (!oficial?.venta) return null;
    return {
      oficialVenta: Math.round(oficial.venta),
      tarjetaVenta: Math.round(tarjeta?.venta || oficial.venta * 1.3),
      fechaActualizacion: oficial.fechaActualizacion || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function isQuotaOrToolError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota')
  );
}

async function fetchLiveComparison(
  destination: Destination,
  tripType: TripType,
  departureDate: string,
  returnDate: string | undefined,
  forceRefresh: boolean
): Promise<LiveTravelData> {
  const effectiveReturn =
    tripType === 'round_trip' && returnDate && returnDate >= departureDate
      ? returnDate
      : undefined;

  const cacheKey = `${destination.id}:${tripType}:${departureDate}:${effectiveReturn || ''}`;
  const cached = travelCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const ai = getGeminiClient();
  const cordobaNow = getCordobaNow();
  const todayIso = cordobaNow.dateIso;
  const liveRates = await fetchLiveArgentinaRates();
  const ratesContext = liveRates
    ? `Tipo de cambio oficial vigente en Argentina hoy: 1 USD = ${liveRates.oficialVenta} ARS (Dólar Tarjeta = ${liveRates.tarjetaVenta} ARS, actualizado ${liveRates.fechaActualizacion}).`
    : '';

  const effectiveDepartureDate =
    departureDate >= todayIso ? departureDate : todayIso;

  const tripLabel =
    tripType === 'round_trip'
      ? `IDA Y VUELTA (salida ${effectiveDepartureDate}, regreso ${effectiveReturn})`
      : `SOLO IDA (salida ${effectiveDepartureDate})`;

  const day1 = new Date(`${todayIso}T12:00:00`);
  day1.setDate(day1.getDate() + 1);
  const day1Iso = day1.toISOString().split('T')[0];

  const day60 = new Date(`${todayIso}T12:00:00`);
  day60.setDate(day60.getDate() + 59);
  const day60Iso = day60.toISOString().split('T')[0];

  const sameDayInstruction =
    effectiveDepartureDate === todayIso
      ? `Como la fecha de salida es HOY (${todayIso}) y en Córdoba son las ${cordobaNow.timeStr}, incluí únicamente salidas futuras posteriores a las ${cordobaNow.timeStr} hs.`
      : '';

  const prompt = `Fecha y hora actual exacta en Córdoba, Argentina: ${cordobaNow.fullDisplay}. ${ratesContext}
Necesito precios reales, vigentes y FINALES (con todos los impuestos, tasas aeroportuarias, IVA y percepciones aplicables incluidos) en Pesos Argentinos (ARS) para un viaje ${tripLabel} desde ${ORIGIN_CORDOBA.city} (${ORIGIN_CORDOBA.iata}, Argentina) hacia ${destination.city} (${destination.iata}, ${destination.country}).
${sameDayInstruction}

Usa datos reales y vigentes del mercado argentino sin inventar cifras ficticias:
1. Precios vigentes actuales en surtidor en Córdoba Capital (YPF Nafta Súper, Nafta Infinia, Infinia Diésel por litro y GNC por m3) y costo real de peajes de UN tramo (solo ida) por ${destination.highwayRoute}.
2. Tarifas reales de vuelos para ${tripLabel} desde Córdoba (COR) a ${destination.city} (${destination.iata}) en aerolíneas que operan esa ruta (${destination.airlines.join(', ')}). Incluye entre 4 y 6 opciones reales (vuelos directos y con 1 escala si corresponde). IMPORTANTE:
   - Si es SOLO IDA, \`priceArs\` debe ser el precio FINAL adulto solo ida (\`baseFareArs + taxesArs = priceArs\`).
   - Si es IDA Y VUELTA, \`priceArs\` debe ser el precio FINAL adulto ida y vuelta (\`baseFareArs + taxesArs = priceArs\`), e incluir \`returnDepartureTime\` y \`returnArrivalTime\`.
   - Incluí \`childPriceArs\` (tarifa final niño de 2 a 11 años según la política real de esa aerolínea y clase tarifaria) e \`infantPriceArs\` (tarifa final bebé 0 a 1 año en brazos: 0 o tasas mínimas en cabotaje argentino según aerolínea, o ~10% en internacional).
3. Tarifas reales de micro / bus larga distancia desde Terminal de Córdoba hacia ${destination.city} en empresas reales (${destination.busOperators.join(', ')}).
4. Panorama completo de ofertas y promociones futuras en \`calendar60Days\`: OBLIGATORIO incluir **60 días consecutivos reales** desde HOY ${todayIso} hasta ${day60Iso} (no resumas en 5 días; entregá los 60 objetos ordenados día por día YYYY-MM-DD) para ${tripLabel}, indicando la tarifa mínima final aérea, aerolínea más económica, escalas, tarifa de micro y \`promoNote\` (ej. "Promo anticipada", "Tarifa baja", "Fin de semana") para poder decidir qué día futuro conviene viajar.
5. 3 o 4 recomendaciones concretas de optimización del ahorro para este trayecto.

Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin texto adicional fuera del JSON) con esta estructura:
{
  "liveSummary": "Resumen claro en español sobre las tarifas reales vigentes desde ${cordobaNow.fullDisplay} para ${tripLabel}.",
  "tollsOneWayArs": 9200,
  "fuelPrices": {
    "nafta_super": { "label": "Nafta Súper (YPF Córdoba)", "pricePerUnit": 1200, "unit": "L", "referenceStation": "YPF Córdoba Capital" },
    "nafta_infinia": { "label": "Nafta Infinia (YPF Córdoba)", "pricePerUnit": 1460, "unit": "L", "referenceStation": "YPF Córdoba Capital" },
    "diesel_infinia": { "label": "Infinia Diésel (YPF Córdoba)", "pricePerUnit": 1490, "unit": "L", "referenceStation": "YPF Córdoba Capital" },
    "gnc": { "label": "GNC (Córdoba Capital)", "pricePerUnit": 650, "unit": "m3", "referenceStation": "Estaciones GNC Córdoba" }
  },
  "flights": [
    {
      "id": "fl-1",
      "airline": "Flybondi",
      "airlineCode": "FO",
      "flightNumber": "FO 5411",
      "departureTime": "08:15",
      "arrivalTime": "09:40",
      "returnDepartureTime": "${tripType === 'round_trip' ? '19:20' : ''}",
      "returnArrivalTime": "${tripType === 'round_trip' ? '20:45' : ''}",
      "durationMinutes": 85,
      "stops": 0,
      "stopoverCity": "",
      "baseFareArs": 92000,
      "taxesArs": 36000,
      "priceArs": 128000,
      "childPriceArs": 128000,
      "infantPriceArs": 0,
      "baggageIncluded": "Artículo personal",
      "fareClass": "Light",
      "sourceNote": "Tarifa final ${tripType === 'round_trip' ? 'ida y vuelta' : 'solo ida'} con tasas e impuestos"
    }
  ],
  "buses": [
    {
      "id": "bus-1",
      "operator": "General Urquiza",
      "serviceClass": "Cama Ejecutivo",
      "departureTime": "22:30",
      "arrivalTime": "08:00",
      "returnDepartureTime": "${tripType === 'round_trip' ? '21:45' : ''}",
      "durationMinutes": 570,
      "priceArs": 118000,
      "terminalOrigin": "Terminal de Córdoba (T1/T2)",
      "terminalDest": "Terminal de destino",
      "notes": "Tarifa final ${tripType === 'round_trip' ? 'ida y vuelta' : 'solo ida'}"
    }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Recomendación de ahorro real",
      "category": "fecha",
      "estimatedSavingsArs": 25000,
      "estimatedSavingsPercent": 18,
      "description": "Explicación concreta."
    }
  ],
  "calendar60Days": [
    {
      "date": "${todayIso}",
      "cheapestFlightArs": 145000,
      "cheapestAirline": "Flybondi",
      "stops": 0,
      "busFareArs": 118000,
      "promoNote": "Tarifa del día"
    },
    {
      "date": "${day1Iso}",
      "cheapestFlightArs": 128000,
      "cheapestAirline": "Flybondi",
      "stops": 0,
      "busFareArs": 118000,
      "promoNote": "Tarifa baja"
    }
  ]
}`;

  let response;
  let groundingMode: LiveTravelData['groundingMode'] = 'google_search';

  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  } catch (searchErr) {
    if (!isQuotaOrToolError(searchErr)) {
      throw searchErr;
    }
    groundingMode = 'live_fx_fallback';
    try {
      response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch (hydrogenErr) {
      if (!isQuotaOrToolError(hydrogenErr)) {
        throw hydrogenErr;
      }
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
    }
  }

  const text = response.text;
  if (!text) {
    throw new Error('El modelo no devolvió contenido al consultar precios en vivo.');
  }

  const parsed = extractJsonObject(text);

  const rawFuel = (parsed.fuelPrices || {}) as Record<string, Partial<FuelPriceEntry>>;
  const fuelTypes: FuelType[] = ['nafta_super', 'nafta_infinia', 'diesel_infinia', 'gnc'];
  const defaultLabels: Record<FuelType, { label: string; unit: 'L' | 'm3' }> = {
    nafta_super: { label: 'Nafta Súper (Córdoba)', unit: 'L' },
    nafta_infinia: { label: 'Nafta Infinia (Córdoba)', unit: 'L' },
    diesel_infinia: { label: 'Infinia Diésel (Córdoba)', unit: 'L' },
    gnc: { label: 'GNC (Córdoba)', unit: 'm3' },
  };

  const fuelPrices = {} as Record<FuelType, FuelPriceEntry>;
  for (const ft of fuelTypes) {
    const entry = rawFuel[ft] || {};
    const price = Number(entry.pricePerUnit);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`No se pudo obtener el precio vigente de combustible (${ft}).`);
    }
    fuelPrices[ft] = {
      type: ft,
      label: typeof entry.label === 'string' && entry.label ? entry.label : defaultLabels[ft].label,
      pricePerUnit: Math.round(price),
      unit: entry.unit === 'm3' || ft === 'gnc' ? 'm3' : 'L',
      referenceStation:
        typeof entry.referenceStation === 'string' && entry.referenceStation
          ? entry.referenceStation
          : 'Estación de servicio Córdoba Capital',
    };
  }

  const rawFlights = Array.isArray(parsed.flights) ? parsed.flights : [];
  const flights: FlightOption[] = rawFlights
    .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === 'object'))
    .map((f, idx) => {
      const rawBase = Math.round(Number(f.baseFareArs) || 0);
      const rawTaxes = Math.round(Number(f.taxesArs) || 0);
      const rawTotal = Math.round(Number(f.priceArs) || 0);
      const finalPrice = rawTotal > 0 ? rawTotal : rawBase + rawTaxes;
      const baseFareArs = rawBase > 0 && rawBase <= finalPrice ? rawBase : Math.max(0, finalPrice - rawTaxes);
      const taxesArs = rawTaxes > 0 && baseFareArs + rawTaxes === finalPrice ? rawTaxes : Math.max(0, finalPrice - baseFareArs);

      return {
        id: typeof f.id === 'string' && f.id ? f.id : `fl-${idx + 1}`,
        airline:
          typeof f.airline === 'string' && f.airline
            ? f.airline
            : destination.airlines[0] || 'Aerolíneas Argentinas',
        airlineCode: typeof f.airlineCode === 'string' && f.airlineCode ? f.airlineCode : 'AR',
        flightNumber: typeof f.flightNumber === 'string' && f.flightNumber ? f.flightNumber : `AR ${1500 + idx}`,
        departureTime: typeof f.departureTime === 'string' && f.departureTime ? f.departureTime : '08:00',
        arrivalTime: typeof f.arrivalTime === 'string' && f.arrivalTime ? f.arrivalTime : '09:30',
        returnDepartureTime:
          tripType === 'round_trip' && typeof f.returnDepartureTime === 'string' && f.returnDepartureTime
            ? f.returnDepartureTime
            : undefined,
        returnArrivalTime:
          tripType === 'round_trip' && typeof f.returnArrivalTime === 'string' && f.returnArrivalTime
            ? f.returnArrivalTime
            : undefined,
        durationMinutes: Math.max(40, Math.round(Number(f.durationMinutes) || destination.flightMinutes)),
        stops: Math.min(2, Math.max(0, Math.round(Number(f.stops) || 0))),
        stopoverCity: typeof f.stopoverCity === 'string' && f.stopoverCity ? f.stopoverCity : undefined,
        priceArs: finalPrice,
        baseFareArs,
        taxesArs,
        childPriceArs:
          typeof f.childPriceArs === 'number' && f.childPriceArs > 0
            ? Math.round(f.childPriceArs)
            : finalPrice,
        infantPriceArs:
          typeof f.infantPriceArs === 'number' && f.infantPriceArs >= 0
            ? Math.round(f.infantPriceArs)
            : destination.isInternational
            ? Math.round(finalPrice * 0.1)
            : 0,
        baggageIncluded:
          typeof f.baggageIncluded === 'string' && f.baggageIncluded
            ? f.baggageIncluded
            : 'Equipaje de mano',
        fareClass: typeof f.fareClass === 'string' && f.fareClass ? f.fareClass : 'Económica',
        sourceNote:
          typeof f.sourceNote === 'string' && f.sourceNote
            ? f.sourceNote
            : tripType === 'round_trip'
            ? 'Tarifa final ida y vuelta con impuestos'
            : 'Tarifa final solo ida con impuestos',
      };
    })
    .filter((f) => f.priceArs > 1000)
    .sort((a, b) => a.priceArs - b.priceArs);

  const rawBuses = Array.isArray(parsed.buses) ? parsed.buses : [];
  const buses: BusOption[] = rawBuses
    .filter((b): b is Record<string, unknown> => Boolean(b && typeof b === 'object'))
    .map((b, idx) => ({
      id: typeof b.id === 'string' && b.id ? b.id : `bus-${idx + 1}`,
      operator:
        typeof b.operator === 'string' && b.operator
          ? b.operator
          : destination.busOperators[0] || 'Chevallier',
      serviceClass: typeof b.serviceClass === 'string' && b.serviceClass ? b.serviceClass : 'Semi-Cama',
      departureTime: typeof b.departureTime === 'string' && b.departureTime ? b.departureTime : '21:30',
      arrivalTime: typeof b.arrivalTime === 'string' && b.arrivalTime ? b.arrivalTime : '07:15',
      returnDepartureTime:
        tripType === 'round_trip' && typeof b.returnDepartureTime === 'string' && b.returnDepartureTime
          ? b.returnDepartureTime
          : undefined,
      durationMinutes: Math.max(120, Math.round(Number(b.durationMinutes) || destination.busMinutes)),
      priceArs: Math.max(0, Math.round(Number(b.priceArs) || 0)),
      terminalOrigin:
        typeof b.terminalOrigin === 'string' && b.terminalOrigin
          ? b.terminalOrigin
          : ORIGIN_CORDOBA.busTerminal,
      terminalDest:
        typeof b.terminalDest === 'string' && b.terminalDest
          ? b.terminalDest
          : `Terminal de ${destination.city}`,
      notes:
        typeof b.notes === 'string' && b.notes
          ? b.notes
          : tripType === 'round_trip'
          ? 'Tarifa final ida y vuelta'
          : 'Tarifa final solo ida',
    }))
    .filter((b) => b.priceArs > 1000)
    .sort((a, b) => a.priceArs - b.priceArs);

  if (flights.length === 0 && buses.length === 0) {
    throw new Error('No se encontraron tarifas válidas para la ruta consultada.');
  }

  const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  const recommendations: SavingsRecommendation[] = rawRecs
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
    .map((r, idx) => {
      const cat = r.category;
      const validCat: SavingsRecommendation['category'] =
        cat === 'vuelo' || cat === 'combustible' || cat === 'fecha' || cat === 'terrestre'
          ? cat
          : 'vuelo';
      return {
        id: typeof r.id === 'string' && r.id ? r.id : `rec-${idx + 1}`,
        title: typeof r.title === 'string' && r.title ? r.title : 'Optimización recomendada',
        category: validCat,
        estimatedSavingsArs: Math.max(0, Math.round(Number(r.estimatedSavingsArs) || 0)),
        estimatedSavingsPercent: Math.max(0, Math.min(90, Math.round(Number(r.estimatedSavingsPercent) || 0))),
        description: typeof r.description === 'string' ? r.description : '',
      };
    });

  const rawCalendarSource = parsed.calendar60Days ?? parsed.calendarKeyDays;
  const calendar60Days = normalizeCalendarDays(
    rawCalendarSource,
    flights[0]?.airline || destination.airlines[0] || 'Aerolíneas Argentinas',
    todayIso
  );

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: GroundSource[] = [];
  const seenUrls = new Set<string>();
  for (const chunk of groundingChunks) {
    const web = chunk?.web;
    if (web?.uri && !seenUrls.has(web.uri)) {
      seenUrls.add(web.uri);
      sources.push({
        title: web.title || web.uri,
        uri: web.uri,
      });
    }
  }

  const result: LiveTravelData = {
    destinationId: destination.id,
    originCity: ORIGIN_CORDOBA.city,
    originIata: ORIGIN_CORDOBA.iata,
    tripType,
    departureDate: effectiveDepartureDate,
    returnDate: effectiveReturn,
    lastUpdatedIso: new Date().toISOString(),
    cordobaDateTime: cordobaNow.fullDisplay,
    groundingMode,
    exchangeRates: liveRates,
    liveSummary:
      typeof parsed.liveSummary === 'string' && parsed.liveSummary
        ? parsed.liveSummary
        : `Comparativa actualizada (${tripType === 'round_trip' ? 'ida y vuelta' : 'solo ida'}) desde Córdoba hacia ${destination.city}.`,
    tollsOneWayArs: Math.max(0, Math.round(Number(parsed.tollsOneWayArs) || 0)),
    fuelPrices,
    flights,
    buses,
    recommendations,
    calendar60Days,
    sources,
  };

  travelCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/compare-travel', async (req: Request, res: Response) => {
    try {
      const { destinationId, tripType, departureDate, returnDate, forceRefresh } = req.body as {
        destinationId?: string;
        tripType?: TripType;
        departureDate?: string;
        returnDate?: string;
        forceRefresh?: boolean;
      };

      const destination = DESTINATIONS.find((d) => d.id === destinationId);
      if (!destination) {
        res.status(400).json({ error: 'Destino no encontrado.' });
        return;
      }

      const validTripType: TripType = tripType === 'round_trip' ? 'round_trip' : 'one_way';

      const safeDate =
        typeof departureDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(departureDate)
          ? departureDate
          : new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const safeReturnDate =
        validTripType === 'round_trip' &&
        typeof returnDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(returnDate) &&
        returnDate >= safeDate
          ? returnDate
          : undefined;

      const data = await fetchLiveComparison(
        destination,
        validTripType,
        safeDate,
        safeReturnDate,
        Boolean(forceRefresh)
      );
      res.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido al consultar precios.';
      if (message === 'GEMINI_API_KEY_MISSING') {
        res.status(503).json({
          error: 'La clave de Gemini API no está configurada en el servidor (Settings > Secrets).',
          code: 'GEMINI_API_KEY_MISSING',
        });
        return;
      }
      if (isQuotaOrToolError(err)) {
        res.status(429).json({
          error:
            'Se alcanzó el límite temporal de consultas de la API de Gemini. Esperá unos segundos y volvé a intentar, o configurá una clave con facturación en Settings > Secrets.',
          code: 'RESOURCE_EXHAUSTED',
        });
        return;
      }
      console.error('Error in /api/compare-travel:', err);
      res.status(502).json({
        error: `No pudimos completar la consulta en tiempo real: ${message}`,
        code: 'UPSTREAM_ERROR',
      });
    }
  });

  app.post('/api/check-alerts', async (req: Request, res: Response) => {
    try {
      const { alerts } = req.body as { alerts?: PriceAlert[] };
      if (!Array.isArray(alerts) || alerts.length === 0) {
        res.json({ results: [] });
        return;
      }

      const activeAlerts = alerts.filter((a) => a.status !== 'pausada').slice(0, 5);
      const results = [];

      for (const alert of activeAlerts) {
        const destination = DESTINATIONS.find((d) => d.id === alert.destinationId);
        if (!destination) continue;

        const alertTripType: TripType = alert.tripType === 'round_trip' ? 'round_trip' : 'one_way';
        const data = await fetchLiveComparison(
          destination,
          alertTripType,
          alert.targetDate,
          alert.returnDate,
          false
        );
        const matchingFlights = data.flights.filter((f) => {
          const airlineOk =
            alert.preferredAirlines.length === 0 ||
            alert.preferredAirlines.some((pa) => pa.toLowerCase() === f.airline.toLowerCase());
          const stopsOk = f.stops <= alert.maxStops;
          return airlineOk && stopsOk;
        });

        const bestFlight = matchingFlights[0] || data.flights[0];

        const horizonSlice = data.calendar60Days.slice(0, alert.horizonDays || 30);
        const matchingCalendar = horizonSlice.filter((day) => {
          const airlineOk =
            alert.preferredAirlines.length === 0 ||
            alert.preferredAirlines.some(
              (pa) => pa.toLowerCase() === day.cheapestAirline.toLowerCase()
            );
          return airlineOk && day.stops <= alert.maxStops;
        });
        const bestCalendarDay = [...matchingCalendar].sort(
          (a, b) => a.cheapestFlightArs - b.cheapestFlightArs
        )[0];

        if (!bestFlight && !bestCalendarDay) continue;

        const targetPrice = bestFlight?.priceArs ?? bestCalendarDay.cheapestFlightArs;
        const bestOverallPrice =
          bestCalendarDay && bestCalendarDay.cheapestFlightArs < targetPrice
            ? bestCalendarDay.cheapestFlightArs
            : targetPrice;
        const bestDateFound =
          bestCalendarDay && bestCalendarDay.cheapestFlightArs < targetPrice
            ? bestCalendarDay.date
            : alert.targetDate;
        const bestAirline =
          bestCalendarDay && bestCalendarDay.cheapestFlightArs < targetPrice
            ? bestCalendarDay.cheapestAirline
            : bestFlight.airline;
        const bestStops =
          bestCalendarDay && bestCalendarDay.cheapestFlightArs < targetPrice
            ? bestCalendarDay.stops
            : bestFlight.stops;

        const meetsThreshold = bestOverallPrice <= alert.maxPriceArs;
        results.push({
          alertId: alert.id,
          destinationId: alert.destinationId,
          foundPriceArs: bestOverallPrice,
          targetDatePriceArs: targetPrice,
          airline: bestAirline,
          stops: bestStops,
          targetDate: bestDateFound,
          meetsThreshold,
          checkedAtIso: new Date().toISOString(),
        });
      }

      res.json({ results });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al verificar alertas.';
      console.error('Error in /api/check-alerts:', err);
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint de API no encontrado.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RutaCba server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
