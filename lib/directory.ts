import seedPlaces from "@/data/places.json";

export type Place = {
  id: string;
  name: string;
  category: string;
  distance: number;
  walkMinutes: number;
  details: string;
  address: string;
  x: number;
  y: number;
  rating?: number | null;
  ratingCount?: number;
  launchSpotlight?: boolean;
  spotlightEndsAt?: string;
  spotlightNote?: string;
};

export const basePlaces = seedPlaces as Place[];

export function mergeSeededPlaces(stored: Place[]) {
  const placesById = new Map(stored.map((place) => [place.id, place]));
  for (const seed of basePlaces) {
    const saved = placesById.get(seed.id);
    if (!saved) {
      placesById.set(seed.id, seed);
    } else if (seed.launchSpotlight) {
      placesById.set(seed.id, { ...saved, ...seed });
    }
  }
  return Array.from(placesById.values());
}

export function isSpotlight(place: Place, now = Date.now()) {
  return Boolean(place.launchSpotlight && place.spotlightEndsAt && Date.parse(place.spotlightEndsAt) > now);
}
