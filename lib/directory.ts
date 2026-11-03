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

// Seed entries replaced by a fuller listing; dropped from older saved copies.
const retiredPlaceIds = new Set(["the-jailhouse"]);

export function mergeSeededPlaces(stored: Place[]) {
  const placesById = new Map(stored.filter((place) => !retiredPlaceIds.has(place.id)).map((place) => [place.id, place]));
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

export const spotlightDays = 21;

// Builds a guide entry for a place added in the browser; map position is illustrative, not geocoded.
export function createLocalPlace({ name, category, address, details, launchSpotlight, openedAt = new Date() }: { name: string; category: string; address: string; details: string; launchSpotlight: boolean; openedAt?: Date }): Place {
  const seed = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString().slice(-5)}`;
  const spotlightEndsAt = new Date(openedAt);
  spotlightEndsAt.setDate(spotlightEndsAt.getDate() + spotlightDays);
  return {
    id: slug,
    name,
    category,
    distance: Math.max(0.1, ((seed % 35) + 10) / 10),
    walkMinutes: Math.max(2, Math.round(((seed % 35) + 10) / 10 * 20)),
    details,
    address,
    x: 20 + seed % 65,
    y: 18 + (seed * 3) % 66,
    launchSpotlight,
    spotlightEndsAt: launchSpotlight ? spotlightEndsAt.toISOString() : undefined,
    spotlightNote: launchSpotlight ? "New local opening — featured for its first three weeks." : undefined,
  };
}

export function isSpotlight(place: Place, now = Date.now()) {
  return Boolean(place.launchSpotlight && place.spotlightEndsAt && Date.parse(place.spotlightEndsAt) > now);
}
