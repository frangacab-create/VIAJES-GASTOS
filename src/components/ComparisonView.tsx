import React, { useMemo, useState } from 'react';
import {
  Bus,
  Car,
  ExternalLink,
  Plane,
  TrendingDown,
} from 'lucide-react';
import type {
  Destination,
  LiveTravelData,
  PassengerGroup,
  TransportFilter,
  TripType,
  VehicleConfig,
} from '../types/travel.ts';
import {
  calculateBusGroupFinalPrice,
  calculateCarTrip,
  calculateFlightGroupFinalPrice,
  computeArrivalTime,
  filterFlights,
  formatArs,
  formatDuration,
  formatPassengerSummary,
  getTotalTravelers,
} from '../utils/travelCalculations.ts';

interface ComparisonViewProps {
  destination: Destination;
  tripType: TripType;
  liveData: LiveTravelData | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  passengerGroup: PassengerGroup;
  selectedAirlines: string[];
  maxStops: number;
  vehicleConfig: VehicleConfig;
  departureTimeCar: string;
  onGoToCalendar: () => void;
  onGoToFuel: () => void;
  onQuickCreateAlert: (suggestedMaxPrice: number) => void;
}

interface UnifiedOptionRow {
  id: string;
  mode: 'flight' | 'bus' | 'car';
  modeLabel: string;
  operator: string;
  detail: string;
  ageBreakdown: string;
  scheduleMain: string;
  scheduleReturn?: string;
  dayOffset: number;
  durationMinutes: number;
  distanceKm: number;
  stopsLabel: string;
  perTravelerAvgArs: number;
  totalFinalGroupArs: number;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  destination,
  tripType,
  liveData,
  isLoading,
  error,
  onRetry,
  passengerGroup,
  selectedAirlines,
  maxStops,
  vehicleConfig,
  departureTimeCar,
  onGoToCalendar,
  onGoToFuel,
  onQuickCreateAlert,
}) => {
  const [modeFilter, setModeFilter] = useState<TransportFilter>('all');
  const [sortBy, setSortBy] = useState<'price' | 'duration'>('price');

  const filteredFlights = useMemo(() => {
    if (!liveData) return [];
    return filterFlights(liveData.flights, selectedAirlines, maxStops);
  }, [liveData, selectedAirlines, maxStops]);

  const carResult = useMemo(() => {
    if (!liveData) return null;
    return calculateCarTrip(
      destination,
      vehicleConfig,
      liveData.fuelPrices,
      liveData.tollsOneWayArs,
      passengerGroup,
      departureTimeCar,
      tripType
    );
  }, [destination, vehicleConfig, liveData, passengerGroup, departureTimeCar, tripType]);

  const totalTravelers = getTotalTravelers(passengerGroup);
  const groupSummaryLabel = formatPassengerSummary(passengerGroup);

  const unifiedRows = useMemo<UnifiedOptionRow[]>(() => {
    if (!liveData || !carResult) return [];

    const rows: UnifiedOptionRow[] = [];

    for (const fl of filteredFlights) {
      const eta = computeArrivalTime(fl.departureTime, fl.durationMinutes);
      const groupPricing = calculateFlightGroupFinalPrice(
        fl,
        passengerGroup,
        destination.isInternational
      );
      const baseTaxText =
        fl.baseFareArs > 0 && fl.taxesArs > 0
          ? `Base ad. ${formatArs(fl.baseFareArs)} + Imp. ${formatArs(fl.taxesArs)}`
          : fl.sourceNote;

      rows.push({
        id: fl.id,
        mode: 'flight',
        modeLabel: 'Vuelo',
        operator: `${fl.airline} · ${fl.flightNumber}`,
        detail: `${fl.fareClass} · ${fl.baggageIncluded} · ${baseTaxText}`,
        ageBreakdown: groupPricing.breakdownLabel,
        scheduleMain: `${fl.departureTime} → ${fl.arrivalTime || eta.arrivalTime}`,
        scheduleReturn:
          tripType === 'round_trip' && fl.returnDepartureTime
            ? `Regreso ${fl.returnDepartureTime}${fl.returnArrivalTime ? ` → ${fl.returnArrivalTime}` : ''}`
            : undefined,
        dayOffset: eta.dayOffset,
        durationMinutes: fl.durationMinutes,
        distanceKm:
          tripType === 'round_trip'
            ? destination.flightDistanceKm * 2
            : destination.flightDistanceKm,
        stopsLabel:
          fl.stops === 0
            ? 'Directo'
            : fl.stops === 1
            ? `1 escala${fl.stopoverCity ? ` (${fl.stopoverCity})` : ''}`
            : `${fl.stops} escalas`,
        perTravelerAvgArs: groupPricing.perTravelerAvgArs,
        totalFinalGroupArs: groupPricing.totalFinalArs,
      });
    }

    for (const bus of liveData.buses) {
      const eta = computeArrivalTime(bus.departureTime, bus.durationMinutes);
      const busPricing = calculateBusGroupFinalPrice(bus, passengerGroup);
      rows.push({
        id: bus.id,
        mode: 'bus',
        modeLabel: 'Micro',
        operator: bus.operator,
        detail: `${bus.serviceClass} · ${bus.terminalOrigin}`,
        ageBreakdown: busPricing.breakdownLabel,
        scheduleMain: `${bus.departureTime} → ${bus.arrivalTime || eta.arrivalTime}`,
        scheduleReturn:
          tripType === 'round_trip'
            ? bus.returnDepartureTime
              ? `Regreso ${bus.returnDepartureTime}`
              : 'Incluye tramo de regreso'
            : undefined,
        dayOffset: eta.dayOffset,
        durationMinutes: bus.durationMinutes,
        distanceKm:
          tripType === 'round_trip'
            ? destination.roadDistanceKm * 2
            : destination.roadDistanceKm,
        stopsLabel: 'Terminal a terminal',
        perTravelerAvgArs: busPricing.perTravelerAvgArs,
        totalFinalGroupArs: busPricing.totalFinalArs,
      });
    }

    const fuelLabel = liveData.fuelPrices[vehicleConfig.fuelType].label;
    rows.push({
      id: 'car-primary',
      mode: 'car',
      modeLabel: 'Auto',
      operator: `Auto particular (${fuelLabel})`,
      detail: `${carResult.litersOrM3Needed} ${carResult.unit} combustible + ${formatArs(carResult.tollsArs)} peajes`,
      ageBreakdown: `${formatArs(carResult.fuelCostArs)} comb. + ${formatArs(carResult.tollsArs)} peajes (${totalTravelers} ${totalTravelers === 1 ? 'viajero' : 'viajeros'})`,
      scheduleMain: `${departureTimeCar} → ${carResult.arrivalTime}`,
      scheduleReturn:
        tripType === 'round_trip'
          ? `Ida ${carResult.oneWayDistanceKm} km + Vuelta ${carResult.oneWayDistanceKm} km`
          : undefined,
      dayOffset: carResult.dayOffset,
      durationMinutes: carResult.oneWayDriveMinutes,
      distanceKm: carResult.totalDistanceKm,
      stopsLabel:
        carResult.refuelStops === 0
          ? 'Sin recarga en ruta'
          : `${carResult.refuelStops} ${carResult.refuelStops === 1 ? 'recarga' : 'recargas'} est.`,
      perTravelerAvgArs: carResult.costPerPassengerArs,
      totalFinalGroupArs: carResult.totalTripCostArs,
    });

    const byMode = rows.filter((r) => modeFilter === 'all' || r.mode === modeFilter);
    return byMode.sort((a, b) =>
      sortBy === 'price'
        ? a.totalFinalGroupArs - b.totalFinalGroupArs
        : a.durationMinutes - b.durationMinutes
    );
  }, [
    liveData,
    carResult,
    filteredFlights,
    destination,
    passengerGroup,
    totalTravelers,
    vehicleConfig.fuelType,
    departureTimeCar,
    modeFilter,
    sortBy,
    tripType,
  ]);

  const bestCheapest = useMemo(() => {
    if (unifiedRows.length === 0) return null;
    return [...unifiedRows].sort((a, b) => a.totalFinalGroupArs - b.totalFinalGroupArs)[0];
  }, [unifiedRows]);

  const bestFastest = useMemo(() => {
    if (unifiedRows.length === 0) return null;
    return [...unifiedRows].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  }, [unifiedRows]);

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
          No se pudieron obtener los precios en tiempo real
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
          {error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
        >
          Reintentar consulta en vivo
        </button>
      </div>
    );
  }

  if (isLoading && !liveData) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando comparativa en tiempo real">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 p-5 space-y-2.5 animate-pulse">
              <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-40 bg-slate-100 dark:bg-slate-800/70 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-11 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!liveData || !carResult) return null;

  const cheapestFlight = filteredFlights[0];
  const cheapestFlightGroup = cheapestFlight
    ? calculateFlightGroupFinalPrice(cheapestFlight, passengerGroup, destination.isInternational)
    : null;
  const tripModeText = tripType === 'round_trip' ? 'Ida y vuelta' : 'Solo ida';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/70 dark:from-emerald-950/50 dark:to-teal-950/30 border border-emerald-200/90 dark:border-emerald-800/70 rounded-2xl shadow-sm p-4 sm:p-5 space-y-1.5">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Precio final grupo ({groupSummaryLabel})
          </p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {bestCheapest ? formatArs(bestCheapest.totalFinalGroupArs) : '—'}
          </p>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
            {bestCheapest
              ? `${bestCheapest.modeLabel} · ${bestCheapest.operator}`
              : 'Ajustá los filtros de aerolíneas o escalas'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 space-y-1.5">
          <p className="text-xs font-semibold text-blue-600 dark:text-sky-400">
            Vuelo final grupo ({tripModeText})
          </p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {cheapestFlightGroup ? formatArs(cheapestFlightGroup.totalFinalArs) : 'Sin coincidencias'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {cheapestFlight && cheapestFlightGroup
              ? `${cheapestFlight.airline} · ${cheapestFlightGroup.breakdownLabel}`
              : 'Probá ampliar escalas máximas'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 space-y-1.5">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Tiempo por tramo más rápido
          </p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {bestFastest ? formatDuration(bestFastest.durationMinutes) : '—'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums truncate">
            {bestFastest
              ? `${bestFastest.modeLabel} · ${bestFastest.scheduleMain}${bestFastest.dayOffset > 0 ? ` (+${bestFastest.dayOffset}d)` : ''}`
              : '—'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 space-y-1.5">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Auto final: Combustible + Peajes ({tripModeText})
          </p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {formatArs(carResult.totalTripCostArs)}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums truncate">
            {carResult.litersOrM3Needed} {carResult.unit} · {formatArs(carResult.costPerPassengerArs)}/viajero
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-blue-700 dark:text-sky-300">
              Córdoba (COR) → {destination.city} ({destination.iata}) · {tripModeText}
            </span>
            <span aria-hidden="true">·</span>
            <span>{destination.highwayRoute}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Relevado {liveData.cordobaDateTime}
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            {liveData.liveSummary}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {liveData.groundingMode === 'google_search'
              ? 'Verificado con búsqueda web en tiempo real (Google Search)'
              : 'Referencia de mercado con tipo de cambio oficial en vivo'}
            {liveData.exchangeRates
              ? ` · Dólar Oficial $${liveData.exchangeRates.oficialVenta.toLocaleString('es-AR')} / Tarjeta $${liveData.exchangeRates.tarjetaVenta.toLocaleString('es-AR')} ARS`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onGoToCalendar}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-sky-950/50 hover:text-blue-700 dark:hover:text-cyan-300 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ver ofertas 30/60 días
          </button>
          <button
            type="button"
            onClick={onGoToFuel}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ajustar vehículo / GNC
          </button>
          {cheapestFlight && (
            <button
              type="button"
              onClick={() =>
                onQuickCreateAlert(Math.round(cheapestFlight.priceArs * 0.88))
              }
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950 text-white shadow-sm shadow-blue-600/20 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Alertar si baja de {formatArs(cheapestFlight.priceArs * 0.88)}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Comparativa multimodal en tiempo real ({tripModeText} · {groupSummaryLabel})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Precio final total incluyendo adultos, tarifas de niños según edad, impuestos, tasas y peajes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'flight', label: 'Vuelos' },
                  { id: 'bus', label: 'Micro' },
                  { id: 'car', label: 'Auto' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setModeFilter(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    modeFilter === tab.id
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => setSortBy('price')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  sortBy === 'price'
                    ? 'bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                Menor precio final
              </button>
              <button
                type="button"
                onClick={() => setSortBy('duration')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  sortBy === 'duration'
                    ? 'bg-indigo-600 text-white shadow-xs dark:bg-indigo-400 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                Menor tiempo
              </button>
            </div>
          </div>
        </div>

        {unifiedRows.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No hay vuelos que coincidan con los filtros seleccionados
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Probá seleccionar más aerolíneas o permitir hasta 1 o 2 escalas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                  <th className="py-3 px-4">Medio / Desglose por edad</th>
                  <th className="py-3 px-4">Horarios</th>
                  <th className="py-3 px-4 text-right">Duración tramo</th>
                  <th className="py-3 px-4 text-right">Distancia total</th>
                  <th className="py-3 px-4">Escalas / Ruta</th>
                  <th className="py-3 px-4 text-right">Promedio / viajero</th>
                  <th className="py-3 px-4 text-right">Precio final ({totalTravelers} {totalTravelers === 1 ? 'viajero' : 'viajeros'})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {unifiedRows.map((row) => {
                  const isCheapestRow = bestCheapest?.id === row.id;
                  const isFastestRow = bestFastest?.id === row.id;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        isCheapestRow
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/25 hover:bg-emerald-50/90 dark:hover:bg-emerald-950/40'
                          : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              row.mode === 'flight'
                                ? 'bg-sky-100 text-blue-600 dark:bg-sky-500/20 dark:text-sky-300'
                                : row.mode === 'bus'
                                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300'
                                : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300'
                            }`}
                          >
                            {row.mode === 'flight' ? (
                              <Plane className="w-4 h-4" aria-hidden="true" />
                            ) : row.mode === 'bus' ? (
                              <Bus className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <Car className="w-4 h-4" aria-hidden="true" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {row.operator}
                              </span>
                              {isCheapestRow && (
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  · Más barato
                                </span>
                              )}
                              {isFastestRow && (
                                <span className="text-xs font-bold text-blue-600 dark:text-cyan-400">
                                  · Más rápido
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {row.detail}
                            </p>
                            <p className="text-xs font-mono tabular-nums text-blue-700 dark:text-sky-400 mt-0.5">
                              {row.ageBreakdown}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-200">
                        <div>
                          {row.scheduleMain}
                          {row.dayOffset > 0 && (
                            <span className="ml-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              +{row.dayOffset}d
                            </span>
                          )}
                        </div>
                        {row.scheduleReturn && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {row.scheduleReturn}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {formatDuration(row.durationMinutes)}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {row.distanceKm.toLocaleString('es-AR')} km
                      </td>

                      <td className="py-3.5 px-4 align-top text-xs text-slate-600 dark:text-slate-300">
                        {row.stopsLabel}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {formatArs(row.perTravelerAvgArs)}
                      </td>

                      <td
                        className={`py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap font-bold ${
                          isCheapestRow
                            ? 'text-emerald-600 dark:text-emerald-400 text-base'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {formatArs(row.totalFinalGroupArs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" aria-hidden="true" />
              </span>
              <span>Recomendaciones para optimizar el ahorro</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              COR → {destination.iata} · {tripModeText}
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {liveData.recommendations.map((rec) => (
              <div key={rec.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {rec.title}
                    </span>
                    <span className="text-xs font-medium text-blue-600 dark:text-sky-400">
                      · Optimización {rec.category}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {rec.description}
                  </p>
                </div>

                {rec.estimatedSavingsArs > 0 && (
                  <div className="sm:text-right shrink-0">
                    <p className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      -{formatArs(rec.estimatedSavingsArs)}
                    </p>
                    {rec.estimatedSavingsPercent > 0 && (
                      <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        Ahorro ~{rec.estimatedSavingsPercent}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Fuentes en tiempo real
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Referencias web y cambiarias consultadas en vivo.
            </p>
          </div>

          {liveData.exchangeRates && (
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                Cotización ARS en vivo (DolarApi)
              </p>
              <p className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                Oficial: ${liveData.exchangeRates.oficialVenta.toLocaleString('es-AR')} · Tarjeta: ${liveData.exchangeRates.tarjetaVenta.toLocaleString('es-AR')}
              </p>
            </div>
          )}

          {liveData.sources.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {liveData.groundingMode === 'google_search'
                ? 'Tarifas obtenidas mediante búsqueda web en vivo.'
                : 'Sin enlaces web externos por límite temporal en búsqueda web; precios ajustados con cotización oficial en vivo.'}
            </p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {liveData.sources.slice(0, 6).map((src) => (
                <li key={src.uri}>
                  <a
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1.5 text-sky-700 dark:text-sky-400 hover:underline break-words"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{src.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
