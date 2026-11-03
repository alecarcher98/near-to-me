import type { LatLng } from "@/lib/types";

const earthRadiusMiles = 3958.8;
const walkingMph = 3;

export function distanceMiles(from: LatLng, to: LatLng) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

export function walkMinutes(miles: number) {
  return Math.max(1, Math.round((miles / walkingMph) * 60));
}

export function formatDistance(miles: number) {
  if (miles < 0.1) return "<0.1 mi";
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function formatTravel(miles: number) {
  return miles <= 2 ? `${walkMinutes(miles)} min walk` : "drive or bus";
}

// Places a point on a square map centred on `origin` where the edge is `radiusMiles` away.
export function projectToMap(origin: LatLng, point: LatLng, radiusMiles: number) {
  const milesPerDegreeLat = 69.0;
  const milesPerDegreeLng = 69.0 * Math.cos((origin.lat * Math.PI) / 180);
  const east = (point.lng - origin.lng) * milesPerDegreeLng;
  const north = (point.lat - origin.lat) * milesPerDegreeLat;
  return { x: 50 + (east / radiusMiles) * 46, y: 50 - (north / radiusMiles) * 46 };
}

export function isUkPostcode(value: string) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());
}
