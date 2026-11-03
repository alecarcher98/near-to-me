import { activeAreaFor } from "@/lib/areas";
import { contentStore } from "@/lib/content-store";
import { placeLabel, resolveLocation } from "@/lib/geocode";
import type { WaitlistEntry, WaitlistSource } from "@/lib/types";
import { makeId } from "@/lib/validation";

export type Coverage =
  | { status: "active"; areaId: string; areaName: string; placeName: string }
  | { status: "coming-soon"; placeName: string }
  | { status: "unknown"; placeName: string };

export async function checkCoverage(input: { location?: string; lat?: number; lng?: number }): Promise<Coverage> {
  const place = await resolveLocation(input);
  if (!place) return { status: "unknown", placeName: input.location?.trim() || "your area" };
  const area = activeAreaFor(place);
  return area ? { status: "active", areaId: area.id, areaName: area.name, placeName: placeLabel(place) } : { status: "coming-soon", placeName: placeLabel(place) };
}

// Saves the person to the coming-soon list unless their location is already covered.
// Locations that can't be resolved are saved too, so admins can read what was typed.
export async function recordInterest(input: { email: string; name?: string; location?: string; lat?: number; lng?: number; source: WaitlistSource; role?: WaitlistEntry["role"] }, options = { saveUnresolved: true }): Promise<Coverage> {
  const place = await resolveLocation(input);
  const area = place ? activeAreaFor(place) : undefined;
  if (place && area) return { status: "active", areaId: area.id, areaName: area.name, placeName: placeLabel(place) };
  if (!place && !options.saveUnresolved) return { status: "unknown", placeName: input.location?.trim() || "your area" };

  const location = input.location?.trim() || (place ? placeLabel(place) : "Shared location");
  const email = input.email.trim().toLowerCase();
  const key = (place ? placeLabel(place) : location).toLowerCase();
  await contentStore.updateWaitlist((entries) => {
    const existing = entries.find((entry) => entry.email === email && (entry.place ? placeLabel(entry.place) : entry.location).toLowerCase() === key);
    if (existing) {
      existing.name = input.name || existing.name;
      existing.createdAt = new Date().toISOString();
      return;
    }
    entries.unshift({
      id: makeId(email.split("@")[0]),
      email,
      ...(input.name ? { name: input.name } : {}),
      location,
      ...(place ? { place } : {}),
      source: input.source,
      ...(input.role ? { role: input.role } : {}),
      createdAt: new Date().toISOString(),
    });
  });
  return place ? { status: "coming-soon", placeName: placeLabel(place) } : { status: "unknown", placeName: location };
}
