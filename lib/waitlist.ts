import { activeAreaFor, type Area } from "@/lib/areas";
import { contentStore } from "@/lib/content-store";
import { placeLabel, resolveLocation } from "@/lib/geocode";
import type { LatLng, ResolvedPlace, WaitlistEntry, WaitlistSource } from "@/lib/types";
import { makeId } from "@/lib/validation";

export type Coverage =
  | { status: "active"; areaId: string; areaName: string; placeName: string }
  | { status: "coming-soon"; placeName: string }
  | { status: "unknown"; placeName: string };

export type InterestInput = { email: string; name?: string; location?: string; lat?: number; lng?: number; source: WaitlistSource; role?: WaitlistEntry["role"] };

export async function checkCoverage(input: { location?: string; lat?: number; lng?: number }): Promise<Coverage> {
  const place = await resolveLocation(input);
  if (!place) return { status: "unknown", placeName: input.location?.trim() || "your area" };
  const area = activeAreaFor(place);
  return area ? { status: "active", areaId: area.id, areaName: area.name, placeName: placeLabel(place) } : { status: "coming-soon", placeName: placeLabel(place) };
}

function waitlistLabel(entry: WaitlistEntry) {
  return entry.place ? placeLabel(entry.place) : entry.location;
}

// Everyone (except businesses) who gives an area and email becomes a member, so the owners can see every sign-up.
async function saveMember(input: InterestInput, place: ResolvedPlace, area: Area | undefined) {
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const location = input.location?.trim() || placeLabel(place);
  await contentStore.updateMembers((members) => {
    const existing = members.find((member) => member.email === email);
    if (existing) {
      existing.location = location;
      existing.place = place;
      existing.status = area ? "live" : "waitlist";
      if (area) existing.areaId = area.id;
      else delete existing.areaId;
      if (input.name) existing.name = input.name;
      existing.updatedAt = now;
      return;
    }
    members.unshift({
      id: makeId(email.split("@")[0]),
      email,
      ...(input.name ? { name: input.name } : {}),
      location,
      place,
      ...(area ? { areaId: area.id } : {}),
      status: area ? "live" : "waitlist",
      createdAt: now,
      updatedAt: now,
    });
  });
}

// Saves the person to the coming-soon list unless their location is already covered, and records them as a member.
// Pass `place` when the location has already been looked up.
async function recordWithPlace(input: InterestInput, place: ResolvedPlace | null, options: { saveUnresolved?: boolean } = {}): Promise<Coverage> {
  const saveUnresolved = options.saveUnresolved ?? true;
  const area = place ? activeAreaFor(place) : undefined;
  if (place && input.role !== "business") await saveMember(input, place, area);
  if (place && area) return { status: "active", areaId: area.id, areaName: area.name, placeName: placeLabel(place) };
  if (!place && !saveUnresolved) return { status: "unknown", placeName: input.location?.trim() || "your area" };

  const location = input.location?.trim() || (place ? placeLabel(place) : "Shared location");
  const email = input.email.trim().toLowerCase();
  const key = (place ? placeLabel(place) : location).toLowerCase();
  await contentStore.updateWaitlist((entries) => {
    const existing = entries.find((entry) => entry.email === email && waitlistLabel(entry).toLowerCase() === key);
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

// Locations that can't be resolved are saved too (unless saveUnresolved is false), so admins can read what was typed.
export async function recordInterest(input: InterestInput, options: { saveUnresolved?: boolean } = {}): Promise<Coverage> {
  return recordWithPlace(input, await resolveLocation(input), options);
}

export type JoinResult =
  | { status: "active"; areaId: string; areaName: string; placeName: string; point: LatLng }
  | { status: "coming-soon"; placeName: string; waiting: number }
  | { status: "unknown"; placeName: string };

// The welcome screen: area and email first. Live areas go straight in; anywhere else joins the coming-soon list.
// Unrecognised places aren't saved, so the visitor can correct them.
export async function join(input: InterestInput): Promise<JoinResult> {
  const place = await resolveLocation(input);
  if (!place) return { status: "unknown", placeName: input.location?.trim() || "your area" };
  const coverage = await recordWithPlace(input, place);
  if (coverage.status === "active") return { ...coverage, point: { lat: place.lat, lng: place.lng } };
  const label = placeLabel(place).toLowerCase();
  const waiting = (await contentStore.readWaitlist()).filter((entry) => waitlistLabel(entry).toLowerCase() === label).length;
  return { status: "coming-soon", placeName: coverage.placeName, waiting };
}
