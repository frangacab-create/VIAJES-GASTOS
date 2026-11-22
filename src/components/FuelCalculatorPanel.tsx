import React, { useMemo } from 'react';
import { Car, Fuel } from 'lucide-react';
import type {
  Destination,
  FuelType,
  LiveTravelData,
  PassengerGroup,
  TripType,
  VehicleConfig,
} from '../types/travel.ts';
import {
  calculateBusGroupFinalPrice,
  calculateCarTrip,
  calculateFlightGroupFinalPrice,
  formatArs,
  formatDuration,
  formatPassengerSummary,
  getTotalTravelers,
} from '../utils/travelCalculations.ts';

interface FuelCalculatorPanelProps {
  destination: Destination;
  tripType: TripType;
  liveData: LiveTravelData | null;
  vehicleConfig: VehicleConfig;
  onChangeVehicle: (next: VehicleConfig) => void;
  departureTimeCar: string;
  onChangeDepartureTimeCar: (time: string) => void;
  passengerGroup: PassengerGroup;
}

export const FuelCalculatorPanel: React.FC<FuelCalculatorPanelProps> = ({
  destination,
  tripType,
  liveData,
  vehicleConfig,
  onChangeVehicle,
  departureTimeCar,
  onChangeDepartureTimeCar,
  passengerGroup,
}) => {
  const fuelTypes: FuelType[] = [
    'nafta_super',
    'nafta_infinia',
    'diesel_infinia',
    'gnc',
  ];

  const handleFuelTypeChange = (fuelType: FuelType) => {
    const defaultConsumption: Record<FuelType, number> = {
      nafta_super: 7.8,
      nafta_infinia: 7.6,
      diesel_infinia: 6.2,
      gnc: 8.5,
    };
    const defaultTank: Record<FuelType, number> = {
      nafta_super: 50,
      nafta_infinia: 50,
      diesel_infinia: 55,
      gnc: 16,
    };
    onChangeVehicle({
      ...vehicleConfig,
      fuelType,
      consumptionPer100Km: defaultConsumption[fuelType],
      tankOrCylinderCapacity: defaultTank[fuelType],
    });
  };

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

  if (!liveData || !carResult) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Esperando datos de precios de combustible en Córdoba Capital...
      </div>
    );
  }

  const cheapestFlight = liveData.flights[0];
  const cheapestBus = liveData.buses[0];
  const tripModeText = tripType === 'round_trip' ? 'Ida y vuelta' : 'Solo ida';
  const totalTravelers = getTotalTravelers(passengerGroup);
  const groupSummary = formatPassengerSummary(passengerGroup);
  const currentGroupBus = cheapestBus
    ? calculateBusGroupFinalPrice(cheapestBus, passengerGroup)
    : null;
  const currentGroupFlight = cheapestFlight
    ? calculateFlightGroupFinalPrice(
        cheapestFlight,
        passengerGroup,
        destination.isInternational
      )
    : null;

  const currentGroupWinner = (() => {
    const candidates = [
      { label: 'Auto particular', val: carResult.totalTripCostArs },
      ...(currentGroupBus && currentGroupBus.totalFinalArs > 0
        ? [{ label: 'Micro', val: currentGroupBus.totalFinalArs }]
        : []),
      ...(currentGroupFlight && currentGroupFlight.totalFinalArs > 0
        ? [{ label: 'Vuelo', val: currentGroupFlight.totalFinalArs }]
        : []),
    ].sort((a, b) => a.val - b.val);
    return candidates[0];
  })();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4" aria-hidden="true" />
              </span>
              <span>
                Calculadora de Combustible y Peajes ({tripModeText}) · Córdoba → {destination.city}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ruta: {destination.highwayRoute} · {carResult.totalDistanceKm.toLocaleString('es-AR')} km totales
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tipo de combustible (precios vigentes en Córdoba Capital)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {fuelTypes.map((ft) => {
                const entry = liveData.fuelPrices[ft];
                const isSelected = vehicleConfig.fuelType === ft;
                return (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => handleFuelTypeChange(ft)}
                    className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'border-transparent bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-600/25 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 hover:border-blue-400 hover:bg-blue-50/60 dark:hover:border-sky-500 dark:hover:bg-sky-950/40'
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold truncate ${
                        isSelected
                          ? 'text-white dark:text-slate-950'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {entry.label.replace(' (Córdoba)', '').replace(' (YPF Córdoba)', '')}
                    </p>
                    <p
                      className={`text-sm font-extrabold font-mono tabular-nums mt-1 ${
                        isSelected
                          ? 'text-white dark:text-slate-950'
                          : 'text-blue-600 dark:text-cyan-400'
                      }`}
                    >
                      {formatArs(entry.pricePerUnit)}/{entry.unit}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="consumption-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Consumo cada 100 km ({carResult.unit})
              </label>
              <input
                id="consumption-input"
                type="number"
                step="0.1"
                min={2}
                max={25}
                value={vehicleConfig.consumptionPer100Km}
                onChange={(e) =>
                  onChangeVehicle({
                    ...vehicleConfig,
                    consumptionPer100Km: Math.max(2, Number(e.target.value) || 7),
                  })
                }
                className="w-full h-10 px-3 text-sm font-mono tabular-nums rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="tank-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Capacidad tanque/tubo ({carResult.unit})
              </label>
              <input
                id="tank-input"
                type="number"
                step="1"
                min={10}
                max={120}
                value={vehicleConfig.tankOrCylinderCapacity}
                onChange={(e) =>
                  onChangeVehicle({
                    ...vehicleConfig,
                    tankOrCylinderCapacity: Math.max(10, Number(e.target.value) || 45),
                  })
                }
                className="w-full h-10 px-3 text-sm font-mono tabular-nums rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="car-departure-time"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Hora de salida estimada
              </label>
              <input
                id="car-departure-time"
                type="time"
                value={departureTimeCar}
                onChange={(e) => onChangeDepartureTimeCar(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={vehicleConfig.splitAcrossPassengers}
                onChange={(e) =>
                  onChangeVehicle({
                    ...vehicleConfig,
                    splitAcrossPassengers: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500"
              />
              <span>
                Dividir combustible y peajes entre {totalTravelers}{' '}
                {totalTravelers === 1 ? 'viajero' : 'viajeros'} ({groupSummary})
              </span>
            </label>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-sky-100 text-blue-600 dark:bg-sky-500/20 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <Fuel className="w-4 h-4" aria-hidden="true" />
                </span>
                <span>Desglose final ({tripModeText})</span>
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {carResult.totalDistanceKm.toLocaleString('es-AR')} km
              </span>
            </div>

            <dl className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600 dark:text-slate-400">
                  Combustible ({carResult.litersOrM3Needed} {carResult.unit})
                </dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatArs(carResult.fuelCostArs)}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600 dark:text-slate-400">
                  Peajes ({tripModeText})
                </dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatArs(carResult.tollsArs)}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600 dark:text-slate-400">Conducción por tramo</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatDuration(carResult.oneWayDriveMinutes)} (llega {carResult.arrivalTime}
                  {carResult.dayOffset > 0 ? ` +${carResult.dayOffset}d` : ''})
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-600 dark:text-slate-400">Recargas estimadas en trayecto</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {carResult.refuelStops} {carResult.refuelStops === 1 ? 'parada' : 'paradas'}
                </dd>
              </div>
              <div className="py-3 flex justify-between gap-4">
                <dt className="font-semibold text-slate-900 dark:text-slate-100">
                  Precio final ({tripModeText})
                </dt>
                <dd className="text-right">
                  <span className="block text-xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatArs(carResult.totalTripCostArs)}
                  </span>
                  <span className="block text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {formatArs(carResult.costPerPassengerArs)} por pasajero
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Punto de equilibrio ({tripModeText}): ¿Cuándo conviene auto frente a micro o avión?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comparativa de precio final total por cantidad de viajeros desde Córdoba Capital
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                <th className="py-3 px-4">Cantidad de viajeros</th>
                <th className="py-3 px-4 text-right">Auto (final grupo)</th>
                <th className="py-3 px-4 text-right">Auto (por persona)</th>
                <th className="py-3 px-4 text-right">Micro ({cheapestBus?.operator || 'Base'})</th>
                <th className="py-3 px-4 text-right">Vuelo ({cheapestFlight?.airline || 'Base'})</th>
                <th className="py-3 px-4">Alternativa más económica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <tr className="bg-gradient-to-r from-blue-50/90 to-cyan-50/60 dark:from-sky-950/50 dark:to-cyan-950/30">
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                  Tu grupo ({groupSummary})
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {formatArs(carResult.totalTripCostArs)}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatArs(Math.round(carResult.totalTripCostArs / totalTravelers))}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {currentGroupBus ? formatArs(currentGroupBus.totalFinalArs) : '—'}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {currentGroupFlight ? formatArs(currentGroupFlight.totalFinalArs) : '—'}
                </td>
                <td className="py-3 px-4 font-semibold text-emerald-700 dark:text-emerald-400">
                  {currentGroupWinner.label} ({formatArs(currentGroupWinner.val)})
                </td>
              </tr>
              {[1, 2, 3, 4].map((pax) => {
                const carTotal = carResult.totalTripCostArs;
                const carPerPax = Math.round(carTotal / pax);
                const busTotal = (cheapestBus?.priceArs || 0) * pax;
                const flightTotal = (cheapestFlight?.priceArs || 0) * pax;

                const candidates = [
                  { label: 'Auto particular', val: carTotal },
                  ...(busTotal > 0 ? [{ label: 'Micro', val: busTotal }] : []),
                  ...(flightTotal > 0 ? [{ label: 'Vuelo', val: flightTotal }] : []),
                ].sort((a, b) => a.val - b.val);

                const winner = candidates[0];

                return (
                  <tr key={pax} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {pax} {pax === 1 ? 'adulto ref.' : 'adultos ref.'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {formatArs(carTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {formatArs(carPerPax)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {busTotal > 0 ? formatArs(busTotal) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {flightTotal > 0 ? formatArs(flightTotal) : '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-700 dark:text-emerald-400">
                      {winner.label} ({formatArs(winner.val)})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
