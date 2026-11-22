import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  ChevronDown,
  Moon,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { DESTINATIONS } from '../data/destinations.ts';
import type { Destination, PassengerGroup, TripType } from '../types/travel.ts';
import { formatPassengerSummary } from '../utils/travelCalculations.ts';

interface SearchWorkspaceBarProps {
  selectedDestinationId: string;
  onSelectDestination: (id: string) => void;
  tripType: TripType;
  onChangeTripType: (type: TripType) => void;
  departureDate: string;
  onChangeDate: (date: string) => void;
  returnDate: string;
  onChangeReturnDate: (date: string) => void;
  passengerGroup: PassengerGroup;
  onChangePassengerGroup: (next: PassengerGroup) => void;
  selectedAirlines: string[];
  onToggleAirline: (airline: string) => void;
  onClearAirlines: () => void;
  maxStops: number;
  onChangeMaxStops: (stops: number) => void;
  isDark: boolean;
  onToggleDark: () => void;
  pushPermission: NotificationPermission | 'unsupported';
  onRequestPush: () => void;
  isLoading: boolean;
  onForceRefresh: () => void;
  currentDestination: Destination;
}

export const SearchWorkspaceBar: React.FC<SearchWorkspaceBarProps> = ({
  selectedDestinationId,
  onSelectDestination,
  tripType,
  onChangeTripType,
  departureDate,
  onChangeDate,
  returnDate,
  onChangeReturnDate,
  passengerGroup,
  onChangePassengerGroup,
  selectedAirlines,
  onToggleAirline,
  onClearAirlines,
  maxStops,
  onChangeMaxStops,
  isDark,
  onToggleDark,
  pushPermission,
  onRequestPush,
  isLoading,
  onForceRefresh,
  currentDestination,
}) => {
  const [passengersOpen, setPassengersOpen] = useState(false);

  const domesticDestinations = DESTINATIONS.filter((d) => !d.isInternational);
  const internationalDestinations = DESTINATIONS.filter((d) => d.isInternational);
  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
  }).format(new Date());

  const totalRoadKm =
    tripType === 'round_trip'
      ? currentDestination.roadDistanceKm * 2
      : currentDestination.roadDistanceKm;
  const totalFlightKm =
    tripType === 'round_trip'
      ? currentDestination.flightDistanceKm * 2
      : currentDestination.flightDistanceKm;

  const handleAddChild = () => {
    if (passengerGroup.childAges.length >= 4) return;
    onChangePassengerGroup({
      ...passengerGroup,
      childAges: [...passengerGroup.childAges, 6],
    });
  };

  const handleChangeChildAge = (index: number, age: number) => {
    const nextAges = passengerGroup.childAges.map((val, idx) =>
      idx === index ? age : val
    );
    onChangePassengerGroup({ ...passengerGroup, childAges: nextAges });
  };

  const handleRemoveChild = (index: number) => {
    onChangePassengerGroup({
      ...passengerGroup,
      childAges: passengerGroup.childAges.filter((_, idx) => idx !== index),
    });
  };

  return (
    <section
      aria-label="Configuración de búsqueda y filtros"
      className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4"
    >
      {/* Top workspace utility row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Modalidad del viaje"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/70"
          >
            <button
              type="button"
              onClick={() => onChangeTripType('one_way')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                tripType === 'one_way'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-600/20 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
              }`}
            >
              Solo ida
            </button>
            <button
              type="button"
              onClick={() => onChangeTripType('round_trip')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                tripType === 'round_trip'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-600/20 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60'
              }`}
            >
              Ida y vuelta
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-blue-700 dark:text-sky-300">
              Origen: Córdoba Capital (COR)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {currentDestination.isInternational ? 'Destino limítrofe' : 'Destino nacional'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
              {totalRoadKm.toLocaleString('es-AR')} km ruta
            </span>
            <span aria-hidden="true">/</span>
            <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
              {totalFlightKm.toLocaleString('es-AR')} km aéreo
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRequestPush}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              pushPermission === 'granted'
                ? 'border-emerald-500/80 bg-emerald-500 text-white shadow-xs shadow-emerald-600/20 dark:bg-emerald-500 dark:text-slate-950'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700'
            }`}
          >
            {pushPermission === 'granted' ? (
              <Bell className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <BellOff className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {pushPermission === 'granted'
                ? 'Push Activo'
                : pushPermission === 'denied'
                ? 'Push Bloqueado'
                : 'Activar Push'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleDark}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
            )}
            <span>{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>

          <button
            type="button"
            onClick={onForceRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 shadow-xs shadow-blue-600/20 disabled:opacity-50 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isLoading ? 'Consultando...' : 'Actualizar en vivo'}</span>
          </button>
        </div>
      </div>

      {/* Primary Search Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
        <div className="md:col-span-4">
          <label
            htmlFor="destination-select"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Destino desde Córdoba Capital (COR)
          </label>
          <select
            id="destination-select"
            value={selectedDestinationId}
            onChange={(e) => onSelectDestination(e.target.value)}
            className="w-full h-10 px-3 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
          >
            <optgroup label="Argentina — Principales destinos">
              {domesticDestinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.city} ({d.iata}) · {d.provinceOrCountry} — {d.roadDistanceKm} km
                </option>
              ))}
            </optgroup>
            <optgroup label="Países Limítrofes — Sudamérica">
              {internationalDestinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.city}, {d.country} ({d.iata}) — {d.roadDistanceKm} km
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className={tripType === 'round_trip' ? 'md:col-span-2' : 'md:col-span-3'}>
          <label
            htmlFor="departure-date"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Fecha de salida
          </label>
          <input
            id="departure-date"
            type="date"
            min={todayIso}
            value={departureDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className="w-full h-10 px-3 text-sm font-mono tabular-nums font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
          />
        </div>

        {tripType === 'round_trip' && (
          <div className="md:col-span-2">
            <label
              htmlFor="return-date"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Fecha de regreso
            </label>
            <input
              id="return-date"
              type="date"
              min={departureDate}
              value={returnDate}
              onChange={(e) => onChangeReturnDate(e.target.value)}
              className="w-full h-10 px-3 text-sm font-mono tabular-nums font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            />
          </div>
        )}

        <div className={tripType === 'round_trip' ? 'md:col-span-2' : 'md:col-span-3'}>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Pasajeros y edades
          </span>
          <button
            type="button"
            onClick={() => setPassengersOpen((prev) => !prev)}
            aria-expanded={passengersOpen}
            className={`w-full h-10 px-3 text-sm font-semibold rounded-xl border flex items-center justify-between gap-2 transition-all duration-150 cursor-pointer ${
              passengersOpen
                ? 'border-blue-600 dark:border-cyan-400 bg-blue-50 dark:bg-sky-950/60 text-blue-800 dark:text-cyan-200 ring-2 ring-blue-500/20'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500'
            }`}
          >
            <span className="inline-flex items-center gap-2 truncate">
              <Users className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" aria-hidden="true" />
              <span className="truncate">{formatPassengerSummary(passengerGroup)}</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                passengersOpen ? 'rotate-180 text-blue-600 dark:text-cyan-400' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="max-stops-select"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Escalas máximas
          </label>
          <select
            id="max-stops-select"
            value={maxStops}
            onChange={(e) => onChangeMaxStops(Number(e.target.value))}
            className="w-full h-10 px-3 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value={0}>Solo directos (0)</option>
            <option value={1}>Hasta 1 escala</option>
            <option value={2}>Hasta 2 escalas</option>
          </select>
        </div>
      </div>

      {/* Expandable Passengers & Children Ages Selector */}
      {passengersOpen && (
        <div className="p-4 rounded-xl border border-blue-200 dark:border-sky-800/80 bg-blue-50/50 dark:bg-sky-950/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Adultos (12+ años)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tarifa estándar por pasajero
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onChangePassengerGroup({
                      ...passengerGroup,
                      adults: Math.max(1, passengerGroup.adults - 1),
                    })
                  }
                  disabled={passengerGroup.adults <= 1}
                  className="w-8 h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  -
                </button>
                <span className="w-6 text-center font-mono tabular-nums text-sm font-semibold">
                  {passengerGroup.adults}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangePassengerGroup({
                      ...passengerGroup,
                      adults: Math.min(6, passengerGroup.adults + 1),
                    })
                  }
                  disabled={passengerGroup.adults >= 6}
                  className="w-8 h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddChild}
                disabled={passengerGroup.childAges.length >= 4}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 shadow-xs disabled:opacity-40 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Agregar niño (0 a 11 años)</span>
              </button>
              <button
                type="button"
                onClick={() => setPassengersOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Listo
              </button>
            </div>
          </div>

          {passengerGroup.childAges.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-blue-200/70 dark:border-slate-800">
              {passengerGroup.childAges.map((age, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs"
                >
                  <label
                    htmlFor={`child-age-${idx}`}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                  >
                    Niño {idx + 1}:
                  </label>
                  <select
                    id={`child-age-${idx}`}
                    value={age}
                    onChange={(e) => handleChangeChildAge(idx, Number(e.target.value))}
                    className="flex-1 h-8 px-2 text-xs font-mono tabular-nums rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value={0}>0 años (bebé)</option>
                    <option value={1}>1 año (bebé)</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((y) => (
                      <option key={y} value={y}>
                        {y} años
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveChild(idx)}
                    aria-label={`Quitar niño ${idx + 1}`}
                    className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Criterio aplicado en tiempo real: <strong>Aviones</strong> (0–1 año en brazos tarifa infante · 2–11 años tarifa menor según aerolínea) · <strong>Micros CNRT</strong> (0–4 años gratis sin butaca · 5+ años tarifa completa) · <strong>Auto</strong> (costo fijo del vehículo).
          </p>
        </div>
      )}

      {/* Airline Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" aria-hidden="true" />
          <span>Aerolíneas en ruta:</span>
        </span>
        <button
          type="button"
          onClick={onClearAirlines}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
            selectedAirlines.length === 0
              ? 'border-transparent bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs shadow-blue-600/20 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-700 dark:hover:text-cyan-300'
          }`}
        >
          Todas ({currentDestination.airlines.length})
        </button>
        {currentDestination.airlines.map((airline) => {
          const active = selectedAirlines.includes(airline);
          return (
            <button
              key={airline}
              type="button"
              onClick={() => onToggleAirline(airline)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'border-transparent bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs shadow-blue-600/20 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50/70 dark:hover:border-sky-500 dark:hover:bg-sky-950/40'
              }`}
            >
              {airline}
            </button>
          );
        })}
      </div>
    </section>
  );
};
