import { distanceMiles } from "@/lib/geo";
import type { LatLng, Place } from "@/lib/types";

export const categories = [
  "Food",
  "Healthy eats",
  "Shopping",
  "Gyms & fitness",
  "Attractions & days out",
  "Pubs & bars",
  "Parking",
  "EV charging",
  "Travel",
  "ATMs & Currency Exchange",
  "Laundry",
  "A&E",
];

// "Healthy eats" is a tag filter over food places rather than a stored category.
export const placeCategories = categories.filter((category) => category !== "Healthy eats");

export const categoryColors: Record<string, string> = {
  Food: "#e5753b",
  "Healthy eats": "#3f9a52",
  Shopping: "#cf4c7b",
  "Gyms & fitness": "#2f7fb8",
  Parking: "#4260c9",
  "EV charging": "#0f9d8a",
  "ATMs & Currency Exchange": "#b48934",
  "Pubs & bars": "#a74b27",
  "Attractions & days out": "#178457",
  Travel: "#168a84",
  Laundry: "#7954c5",
  "A&E": "#d43d50",
};

export function categoryColor(category: string) {
  return categoryColors[category] ?? "#188459";
}

export function matchesCategory(place: Place, category: string) {
  if (category === "Healthy eats") return Boolean(place.tags?.includes("healthy"));
  return place.category === category;
}

export function isSpotlight(place: Place, now = Date.now()) {
  return Boolean(place.launchSpotlight && place.spotlightEndsAt && Date.parse(place.spotlightEndsAt) > now);
}

export function isSponsored(place: Place, now = Date.now()) {
  return Boolean(place.sponsored && (!place.sponsoredUntil || Date.parse(place.sponsoredUntil) > now));
}

export type NearbyPlace = Place & { miles: number };

export function withDistance(places: Place[], origin: LatLng): NearbyPlace[] {
  return places.map((place) => ({ ...place, miles: distanceMiles(origin, place) }));
}

// Just-opened first, then sponsored, then nearest.
export function rankNearby(places: NearbyPlace[], now = Date.now()) {
  return [...places].sort((a, b) =>
    Number(isSpotlight(b, now)) - Number(isSpotlight(a, now))
    || Number(isSponsored(b, now)) - Number(isSponsored(a, now))
    || a.miles - b.miles);
}

// what3words for a place: the stored field, or one written into older details text. Shown as text to copy, never linked.
export function placeWhat3words(place: Place) {
  const raw = place.what3words ?? place.details.match(/what3words\s+(\/{3}[a-z]+\.[a-z]+\.[a-z]+)/i)?.[1];
  return raw ? `///${raw.replace(/^\/+/, "").toLowerCase()}` : undefined;
}

// Car parks and chargers are found by their exact position; businesses by name and address.
function directionsTarget(place: Place) {
  return place.category === "Parking" || place.category === "EV charging" ? `${place.lat},${place.lng}` : `${place.name}, ${place.address}`;
}

export function googleDirections(place: Place, from?: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsTarget(place))}${from ? `&origin=${from.lat},${from.lng}` : ""}`;
}

export function appleDirections(place: Place, from?: LatLng) {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(directionsTarget(place))}${from ? `&saddr=${from.lat},${from.lng}` : ""}&dirflg=d`;
}

export function nearestByCategory(places: NearbyPlace[], category: string, count: number) {
  return places.filter((place) => matchesCategory(place, category)).sort((a, b) => a.miles - b.miles).slice(0, count);
}
