import nuneatonEvents from "@/data/nuneaton-events.json";
import nuneatonPlaces from "@/data/nuneaton-places.json";
import { distanceMiles } from "@/lib/geo";
import type { LatLng, LocalEvent, Place } from "@/lib/types";

export type Area = {
  id: string;
  name: string;
  centre: LatLng;
  // Council districts the guide covers; anyone elsewhere is told it's coming soon.
  districts: string[];
  // Fallback when a location has no district (for example a shared GPS position far from any postcode).
  serviceRadiusMiles: number;
  seedPlaces: Place[];
  seedEvents: LocalEvent[];
};

// Each area is seeded from data/<area>-places.json and data/<area>-events.json.
export const areas: Record<string, Area> = {
  nuneaton: {
    id: "nuneaton",
    name: "Nuneaton",
    centre: { lat: 52.5229, lng: -1.4679 },
    districts: ["Nuneaton and Bedworth"],
    serviceRadiusMiles: 3,
    seedPlaces: nuneatonPlaces as Place[],
    seedEvents: nuneatonEvents as LocalEvent[],
  },
};

export const defaultAreaId = "nuneaton";

export function getArea(areaId: string | null | undefined) {
  return areaId && Object.hasOwn(areas, areaId) ? areas[areaId] : undefined;
}

// The live area covering a place, if any.
export function activeAreaFor(place: LatLng & { district?: string }) {
  const district = place.district?.toLowerCase();
  if (district) return Object.values(areas).find((area) => area.districts.some((name) => name.toLowerCase() === district));
  return Object.values(areas)
    .map((area) => ({ area, miles: distanceMiles(area.centre, place) }))
    .filter(({ area, miles }) => miles <= area.serviceRadiusMiles)
    .sort((a, b) => a.miles - b.miles)[0]?.area;
}
