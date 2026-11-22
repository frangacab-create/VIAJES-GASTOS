export type FuelType = 'nafta_super' | 'nafta_infinia' | 'diesel_infinia' | 'gnc';

export type TripType = 'one_way' | 'round_trip';

export type TransportFilter = 'all' | 'flight' | 'bus' | 'car';

export interface Destination {
  id: string;
  city: string;
  provinceOrCountry: string;
  country: 'Argentina' | 'Chile' | 'Uruguay' | 'Brasil' | 'Paraguay' | 'Bolivia';
  isInternational: boolean;
  iata: string;
  roadDistanceKm: number;
  flightDistanceKm: number;
  driveMinutes: number;
  busMinutes: number;
  flightMinutes: number;
  highwayRoute: string;
  airlines: string[];
  busOperators: string[];
  description: string;
}

export interface FuelPriceEntry {
  type: FuelType;
  label: string;
  pricePerUnit: number;
  unit: 'L' | 'm3';
  referenceStation: string;
}

export interface VehicleConfig {
  fuelType: FuelType;
  consumptionPer100Km: number;
  tankOrCylinderCapacity: number;
  splitAcrossPassengers: boolean;
}

export interface PassengerGroup {
  adults: number; // 12+ años
  childAges: number[]; // edades exactas de 0 a 11 años
}

export interface FlightOption {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  returnDepartureTime?: string;
  returnArrivalTime?: string;
  durationMinutes: number;
  stops: number;
  stopoverCity?: string;
  priceArs: number;
  baseFareArs: number;
  taxesArs: number;
  childPriceArs?: number; // Precio final niño 2-11 años
  infantPriceArs?: number; // Precio final bebé 0-1 años en brazos
  baggageIncluded: string;
  fareClass: string;
  sourceNote: string;
}

export interface BusOption {
  id: string;
  operator: string;
  serviceClass: string;
  departureTime: string;
  arrivalTime: string;
  returnDepartureTime?: string;
  durationMinutes: number;
  priceArs: number;
  terminalOrigin: string;
  terminalDest: string;
  notes: string;
}

export interface SavingsRecommendation {
  id: string;
  title: string;
  category: 'vuelo' | 'combustible' | 'fecha' | 'terrestre';
  estimatedSavingsArs: number;
  estimatedSavingsPercent: number;
  description: string;
}

export interface DailyFareOffer {
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
  dealLevel: 'oferta' | 'normal' | 'alto';
  savingsVsAvgPercent: number;
}

export interface GroundSource {
  title: string;
  uri: string;
}

export interface ExchangeRateSnapshot {
  oficialVenta: number;
  tarjetaVenta: number;
  fechaActualizacion: string;
}

export interface LiveTravelData {
  destinationId: string;
  originCity: string;
  originIata: string;
  tripType: TripType;
  departureDate: string;
  returnDate?: string;
  lastUpdatedIso: string;
  cordobaDateTime: string;
  groundingMode: 'google_search' | 'live_fx_fallback';
  exchangeRates: ExchangeRateSnapshot | null;
  liveSummary: string;
  tollsOneWayArs: number;
  fuelPrices: Record<FuelType, FuelPriceEntry>;
  flights: FlightOption[];
  buses: BusOption[];
  recommendations: SavingsRecommendation[];
  calendar60Days: DailyFareOffer[];
  sources: GroundSource[];
}

export interface PriceAlert {
  id: string;
  destinationId: string;
  destinationCity: string;
  iata: string;
  tripType: TripType;
  targetDate: string;
  returnDate?: string;
  horizonDays: 30 | 60;
  maxPriceArs: number;
  preferredAirlines: string[];
  maxStops: number;
  pushEnabled: boolean;
  notifyOnDropPercent: number;
  createdAtIso: string;
  lastCheckedIso?: string;
  lastFoundPriceArs?: number;
  status: 'activa' | 'oferta_detectada' | 'pausada';
}

export interface PushNotificationLog {
  id: string;
  alertId: string;
  routeLabel: string;
  title: string;
  body: string;
  priceArs: number;
  timestampIso: string;
  read: boolean;
}
