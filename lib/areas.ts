import nuneatonEvents from "@/data/nuneaton-events.json";
import nuneatonPlaces from "@/data/nuneaton-places.json";
import type { LatLng, LocalEvent, Place } from "@/lib/types";

export type Area = {
  id: string;
  name: string;
  centre: LatLng;
  seedPlaces: Place[];
  seedEvents: LocalEvent[];
};

// Each area is seeded from data/<area>-places.json and data/<area>-events.json.
export const areas: Record<string, Area> = {
  nuneaton: {
    id: "nuneaton",
    name: "Nuneaton",
    centre: { lat: 52.5229, lng: -1.4679 },
    seedPlaces: nuneatonPlaces as Place[],
    seedEvents: nuneatonEvents as LocalEvent[],
  },
};

export const defaultAreaId = "nuneaton";

export function getArea(areaId: string | null | undefined) {
  return areaId && Object.hasOwn(areas, areaId) ? areas[areaId] : undefined;
}
