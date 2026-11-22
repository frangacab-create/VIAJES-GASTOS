import React, { useMemo, useState } from 'react';
import { BellPlus, Calendar } from 'lucide-react';
import type {
  DailyFareOffer,
  Destination,
  LiveTravelData,
  TripType,
} from '../types/travel.ts';
import { filterCalendarOffers, formatArs } from '../utils/travelCalculations.ts';

interface FareCalendarPanelProps {
  destination: Destination;
  tripType: TripType;
  liveData: LiveTravelData | null;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  selectedAirlines: string[];
  maxStops: number;
  onCreateAlertForDay: (day: DailyFareOffer, horizon: 30 | 60) => void;
}

export const FareCalendarPanel: React.FC<FareCalendarPanelProps> = ({
  destination,
  tripType,
  liveData,
  selectedDate,
  onSelectDate,
  selectedAirlines,
  maxStops,
  onCreateAlertForDay,
}) => {
  const [horizon, setHorizon] = useState<30 | 60>(30);
  const [onlyDeals, setOnlyDeals] = useState<boolean>(false);

  const baseDays = useMemo(() => {
    if (!liveData) return [];
    return filterCalendarOffers(
      liveData.calendar60Days,
      horizon,
      selectedAirlines,
      maxStops
    );
  }, [liveData, horizon, selectedAirlines, maxStops]);

  const visibleDays = useMemo(() => {
    if (!onlyDeals) return baseDays;
    return baseDays.filter((d) => d.dealLevel === 'oferta' || d.savingsVsAvgPercent >= 8);
  }, [baseDays, onlyDeals]);

  const stats = useMemo(() => {
    if (baseDays.length === 0) return null;
    const sorted = [...baseDays].sort(
      (a, b) => a.cheapestFlightArs - b.cheapestFlightArs
    );
    const bestDay = sorted[0];
    const worstDay = sorted[sorted.length - 1];
    const avg = Math.round(
      baseDays.reduce((sum, d) => sum + d.cheapestFlightArs, 0) /
        baseDays.length
    );
    const offerDays = baseDays.filter((d) => d.dealLevel === 'oferta');
    return { bestDay, worstDay, avg, offerDaysCount: offerDays.length };
  }, [baseDays]);

  if (!liveData) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Cargando calendario real de ofertas futuras...
      </div>
    );
  }

  const maxChartFare = Math.max(
    1,
    ...baseDays.map((d) => d.cheapestFlightArs)
  );
  const tripModeText = tripType === 'round_trip' ? 'Ida y vuelta' : 'Solo ida';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-sky-100 text-blue-600 dark:bg-sky-500/20 dark:text-sky-300 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" aria-hidden="true" />
              </span>
              <span>
                Ofertas y promociones a {horizon} días ({tripModeText}) · COR → {destination.city}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Relevado desde {liveData.cordobaDateTime} · Filtrado por aerolíneas y hasta {maxStops}{' '}
              {maxStops === 1 ? 'escala' : 'escalas'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => setOnlyDeals(false)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  !onlyDeals
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                Todos los días
              </button>
              <button
                type="button"
                onClick={() => setOnlyDeals(true)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  onlyDeals
                    ? 'bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                Solo mejores ofertas
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => setHorizon(30)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  horizon === 30
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                Próximos 30 días
              </button>
              <button
                type="button"
                onClick={() => setHorizon(60)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  horizon === 60
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                Próximos 60 días
              </button>
            </div>
          </div>
        </div>

        {stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/75 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Mejor fecha futura para viajar ({tripModeText})
              </p>
              <p className="text-xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatArs(stats.bestDay.cheapestFlightArs)}
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {stats.bestDay.dayOfWeek} {stats.bestDay.dayNumber} {stats.bestDay.monthLabel} · {stats.bestDay.cheapestAirline}
                {stats.bestDay.promoNote ? ` · ${stats.bestDay.promoNote}` : ''}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Tarifa final promedio ({baseDays.length} días futuros)
              </p>
              <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                {formatArs(stats.avg)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                Ahorro vs pico: {formatArs(stats.worstDay.cheapestFlightArs - stats.bestDay.cheapestFlightArs)}
              </p>
            </div>

            <div className="bg-sky-50/75 dark:bg-sky-950/35 border border-sky-200 dark:border-sky-800/80 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-700 dark:text-sky-300">
                  Días con promoción activa
                </p>
                <p className="text-xl font-extrabold font-mono tabular-nums text-blue-600 dark:text-cyan-400">
                  {stats.offerDaysCount} días
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Al menos 10% bajo promedio
                </p>
              </div>
              <button
                type="button"
                onClick={() => onCreateAlertForDay(stats.bestDay, horizon)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950 text-white shadow-sm shadow-blue-600/20 transition-all duration-150 shrink-0 cursor-pointer"
              >
                <BellPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Alertar mejor día</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400">
            No hay fechas futuras disponibles con los filtros seleccionados. Probá ampliar aerolíneas o escalas máximas.
          </div>
        )}

        {baseDays.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>Tendencia futura de tarifa final aérea (ARS)</span>
              <span>Verde: Oferta · Azul: Seleccionado · Ámbar: Pico</span>
            </div>
            <div className="h-32 flex items-end gap-1 overflow-x-auto pb-1">
              {baseDays.map((day) => {
                const heightPct = Math.max(
                  14,
                  Math.round((day.cheapestFlightArs / maxChartFare) * 100)
                );
                const isSelected = day.date === selectedDate;
                const barColor = isSelected
                  ? 'bg-gradient-to-t from-blue-600 to-cyan-400 dark:from-sky-500 dark:to-cyan-300'
                  : day.dealLevel === 'oferta'
                  ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 dark:from-emerald-600 dark:to-emerald-400'
                  : day.dealLevel === 'alto'
                  ? 'bg-gradient-to-t from-amber-500 to-orange-400 dark:from-amber-500 dark:to-amber-400'
                  : 'bg-slate-300 dark:bg-slate-700';

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => onSelectDate(day.date)}
                    title={`${day.dayOfWeek} ${day.dayNumber} ${day.monthLabel}: ${formatArs(day.cheapestFlightArs)} (${day.cheapestAirline})`}
                    className="flex-1 min-w-[10px] h-full flex flex-col justify-end group cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-sm transition-opacity group-hover:opacity-80 ${barColor}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {visibleDays.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-center text-sm text-slate-600 dark:text-slate-400">
          No hay días marcados con descuento superior al 8% en esta ventana. Cambiá a "Todos los días" para ver la grilla completa.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {visibleDays.map((day) => {
            const isSelected = day.date === selectedDate;
            const isBest = stats?.bestDay.date === day.date;

            return (
              <div
                key={day.date}
                className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-150 ${
                  isSelected
                    ? 'border-blue-600 dark:border-cyan-400 bg-gradient-to-br from-blue-50 to-cyan-50/70 dark:from-sky-950/60 dark:to-cyan-950/40 ring-2 ring-blue-500/25 shadow-sm'
                    : day.dealLevel === 'oferta'
                    ? 'border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/35 dark:bg-emerald-950/20 hover:border-emerald-500 shadow-xs'
                    : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-sky-600 shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDate(day.date)}
                  className="text-left w-full space-y-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {day.dayOfWeek} {day.dayNumber} {day.monthLabel}
                    </span>
                    {isBest ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Mínimo
                      </span>
                    ) : day.dealLevel === 'oferta' ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        -{Math.max(1, day.savingsVsAvgPercent)}%
                      </span>
                    ) : null}
                  </div>

                  <p className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                    {formatArs(day.cheapestFlightArs)}
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {day.cheapestAirline} · {day.stops === 0 ? 'Directo' : `${day.stops} esc.`}
                  </p>

                  {day.promoNote && (
                    <p className="text-[11px] font-medium text-blue-700 dark:text-cyan-400 truncate">
                      {day.promoNote}
                    </p>
                  )}
                </button>

                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono tabular-nums">
                    {day.busFareArs > 0 ? `Bus ${formatArs(day.busFareArs)}` : 'Solo aéreo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCreateAlertForDay(day, horizon)}
                    className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-sky-950/60 text-blue-700 dark:text-cyan-300 hover:bg-blue-600 hover:text-white dark:hover:bg-cyan-400 dark:hover:text-slate-950 font-semibold transition-colors cursor-pointer"
                  >
                    Alertar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
