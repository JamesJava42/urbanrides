export const DEFAULT_REGION_NAME = 'Long Beach';
export const SERVICE_RADIUS_MILES = 12;
export const MAX_TRIP_MILES = 25;
export const DISTANCE_TOLERANCE_MILES = 2;

export const BASE_FARE_USD = 6;
export const PER_MILE_FARE_USD = 2.5;

export const REGION_CENTER = {
  lat: 33.7701,
  lng: -118.1937,
};

export type RideLifecycleStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED_PICKUP'
  | 'COMMUNICATION_FAILED'
  | 'PASSENGER_NO_SHOW'
  | 'NO_DRIVER_AVAILABLE';

export const STATUS_LABELS: Record<RideLifecycleStatus, string> = {
  PENDING: 'Waiting for driver',
  ACCEPTED: 'Driver accepted',
  ARRIVED: 'Driver arrived',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  FAILED_PICKUP: 'Accepted but pickup failed',
  COMMUNICATION_FAILED: 'Communication failed',
  PASSENGER_NO_SHOW: 'Passenger no-show',
  NO_DRIVER_AVAILABLE: 'No driver available',
};

export function milesBetweenPoints(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

export function getRegionName(): string {
  return process.env.NEXT_PUBLIC_REGION_NAME || DEFAULT_REGION_NAME;
}

export function isInsideServiceArea(lat: number, lng: number): boolean {
  const milesFromCenter = milesBetweenPoints(lat, lng, REGION_CENTER.lat, REGION_CENTER.lng);
  return milesFromCenter <= SERVICE_RADIUS_MILES;
}

export function calculateFare(miles: number): number {
  const normalizedMiles = Math.max(0, miles);
  return BASE_FARE_USD + normalizedMiles * PER_MILE_FARE_USD;
}

export function toPriceLabel(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
