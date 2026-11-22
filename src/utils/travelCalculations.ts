import type {
  BusOption,
  DailyFareOffer,
  Destination,
  FlightOption,
  FuelPriceEntry,
  FuelType,
  PassengerGroup,
  TripType,
  VehicleConfig,
} from '../types/travel.ts';

export function formatArs(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatDuration(totalMinutes: number): string {
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} h`;
  return `${hrs} h ${mins} min`;
}

export function computeArrivalTime(departureTime: string, durationMinutes: number): {
  arrivalTime: string;
  dayOffset: number;
} {
  const [hStr, mStr] = departureTime.split(':');
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  const totalStart = h * 60 + m;
  const totalEnd = totalStart + Math.round(durationMinutes);
  const dayOffset = Math.floor(totalEnd / (24 * 60));
  const normalized = ((totalEnd % (24 * 60)) + 24 * 60) % (24 * 60);
  const arrH = Math.floor(normalized / 60);
  const arrM = normalized % 60;
  return {
    arrivalTime: `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`,
    dayOffset,
  };
}

export function getTotalTravelers(group: PassengerGroup): number {
  return Math.max(1, group.adults) + group.childAges.length;
}

export function formatPassengerSummary(group: PassengerGroup): string {
  const adultsText = `${group.adults} ${group.adults === 1 ? 'adulto' : 'adultos'}`;
  if (group.childAges.length === 0) return adultsText;
  const kidsText = `${group.childAges.length} ${group.childAges.length === 1 ? 'niño' : 'niños'} (${group.childAges.map((a) => `${a}a`).join(', ')})`;
  return `${adultsText}, ${kidsText}`;
}

export interface GroupFareBreakdown {
  totalFinalArs: number;
  perTravelerAvgArs: number;
  breakdownLabel: string;
}

export function calculateFlightGroupFinalPrice(
  flight: FlightOption,
  group: PassengerGroup,
  isInternational: boolean
): GroupFareBreakdown {
  const adultsCount = Math.max(1, group.adults);
  const children2to11 = group.childAges.filter((age) => age >= 2 && age <= 11).length;
  const infants0to1 = group.childAges.filter((age) => age < 2).length;

  const adultUnit = flight.priceArs;
  const childUnit =
    typeof flight.childPriceArs === 'number' && flight.childPriceArs > 0
      ? flight.childPriceArs
      : adultUnit;
  const infantUnit =
    typeof flight.infantPriceArs === 'number' && flight.infantPriceArs >= 0
      ? flight.infantPriceArs
      : isInternational
      ? Math.round(adultUnit * 0.1)
      : 0;

  const totalFinalArs =
    adultsCount * adultUnit +
    children2to11 * childUnit +
    infants0to1 * infantUnit;

  const totalPeople = adultsCount + children2to11 + infants0to1;
  const parts: string[] = [`${adultsCount} ad. ${formatArs(adultUnit)}`];
  if (children2to11 > 0) {
    parts.push(`${children2to11} niño(s) 2-11a ${formatArs(childUnit)}`);
  }
  if (infants0to1 > 0) {
    parts.push(
      `${infants0to1} bebé(s) 0-1a ${infantUnit === 0 ? 'sin cargo' : formatArs(infantUnit)}`
    );
  }

  return {
    totalFinalArs,
    perTravelerAvgArs: Math.round(totalFinalArs / Math.max(1, totalPeople)),
    breakdownLabel: parts.join(' + '),
  };
}

export function calculateBusGroupFinalPrice(
  bus: BusOption,
  group: PassengerGroup
): GroupFareBreakdown {
  const adultsCount = Math.max(1, group.adults);
  // Normativa CNRT Argentina: menores de 0 a 4 años viajan gratis sin ocupar butaca; 5+ años pagan pasaje completo
  const payingChildren = group.childAges.filter((age) => age >= 5).length;
  const freeChildren = group.childAges.filter((age) => age <= 4).length;

  const totalPaying = adultsCount + payingChildren;
  const totalFinalArs = totalPaying * bus.priceArs;
  const totalPeople = adultsCount + group.childAges.length;

  const parts: string[] = [`${totalPaying} pasaje(s) ${formatArs(bus.priceArs)}`];
  if (freeChildren > 0) {
    parts.push(`${freeChildren} menor(es) 0-4a gratis s/butaca`);
  }

  return {
    totalFinalArs,
    perTravelerAvgArs: Math.round(totalFinalArs / Math.max(1, totalPeople)),
    breakdownLabel: parts.join(' + '),
  };
}

export interface CarCalculationResult {
  tripType: TripType;
  oneWayDistanceKm: number;
  totalDistanceKm: number;
  litersOrM3Needed: number;
  unit: 'L' | 'm3';
  fuelCostArs: number;
  tollsArs: number;
  totalTripCostArs: number;
  costPerPassengerArs: number;
  refuelStops: number;
  oneWayDriveMinutes: number;
  totalDriveMinutes: number;
  arrivalTime: string;
  dayOffset: number;
}

export function calculateCarTrip(
  destination: Destination,
  vehicle: VehicleConfig,
  fuelPrices: Record<FuelType, FuelPriceEntry>,
  tollsOneWayArs: number,
  group: PassengerGroup,
  departureTime: string,
  tripType: TripType
): CarCalculationResult {
  const multiplier = tripType === 'round_trip' ? 2 : 1;
  const entry = fuelPrices[vehicle.fuelType];
  const totalDistanceKm = destination.roadDistanceKm * multiplier;
  const litersOrM3Needed = Number(
    ((totalDistanceKm / 100) * vehicle.consumptionPer100Km).toFixed(1)
  );
  const fuelCostArs = Math.round(litersOrM3Needed * entry.pricePerUnit);
  const tollsArs = Math.round(tollsOneWayArs * multiplier);
  const totalTripCostArs = fuelCostArs + tollsArs;
  const totalTravelers = getTotalTravelers(group);
  const costPerPassengerArs = vehicle.splitAcrossPassengers
    ? Math.round(totalTripCostArs / totalTravelers)
    : totalTripCostArs;

  const refuelStops = Math.max(
    0,
    Math.ceil(litersOrM3Needed / Math.max(10, vehicle.tankOrCylinderCapacity)) - 1
  );

  const eta = computeArrivalTime(departureTime, destination.driveMinutes);

  return {
    tripType,
    oneWayDistanceKm: destination.roadDistanceKm,
    totalDistanceKm,
    litersOrM3Needed,
    unit: entry.unit,
    fuelCostArs,
    tollsArs,
    totalTripCostArs,
    costPerPassengerArs,
    refuelStops,
    oneWayDriveMinutes: destination.driveMinutes,
    totalDriveMinutes: destination.driveMinutes * multiplier,
    arrivalTime: eta.arrivalTime,
    dayOffset: eta.dayOffset,
  };
}

export function filterFlights(
  flights: FlightOption[],
  selectedAirlines: string[],
  maxStops: number
): FlightOption[] {
  return flights
    .filter((f) => {
      const airlineMatch =
        selectedAirlines.length === 0 ||
        selectedAirlines.some(
          (a) => a.toLowerCase() === f.airline.toLowerCase()
        );
      const stopsMatch = f.stops <= maxStops;
      return airlineMatch && stopsMatch;
    })
    .sort((a, b) => a.priceArs - b.priceArs);
}

export function filterCalendarOffers(
  offers: DailyFareOffer[],
  horizonDays: 30 | 60,
  selectedAirlines: string[],
  maxStops: number
): DailyFareOffer[] {
  const sliced = offers.slice(0, horizonDays);
  return sliced.filter((day) => {
    const stopsOk = day.stops <= maxStops;
    const airlineOk =
      selectedAirlines.length === 0 ||
      selectedAirlines.some(
        (a) => a.toLowerCase() === day.cheapestAirline.toLowerCase()
      );
    return stopsOk && airlineOk;
  });
}

export function addDaysIso(baseDateIso: string, days: number): string {
  const d = new Date(`${baseDateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return now.toISOString().split('T')[0];
  }
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getDefaultDepartureDateIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}
