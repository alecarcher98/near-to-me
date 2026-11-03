import type { ResolvedPlace } from "@/lib/types";

// UK place lookups via postcodes.io (free, no key). Returns null rather than throwing.
const api = "https://api.postcodes.io";
const postcodePattern = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

type PostcodeResult = { postcode: string; latitude: number | null; longitude: number | null; admin_district?: string | null; parish?: string | null; admin_county?: string | null; region?: string | null };
type PlaceResult = { name_1: string; latitude: number; longitude: number; district_borough?: string | null; county_unitary?: string | null; region?: string | null };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    return ((await response.json()) as { result?: T }).result ?? null;
  } catch {
    return null;
  }
}

function fromPostcode(result: PostcodeResult | null | undefined): ResolvedPlace | null {
  if (!result || result.latitude == null || result.longitude == null) return null;
  return {
    name: result.admin_district ?? result.parish ?? result.postcode,
    district: result.admin_district ?? undefined,
    county: result.admin_county ?? result.region ?? undefined,
    postcode: result.postcode,
    lat: result.latitude,
    lng: result.longitude,
  };
}

export async function resolveLocation(input: { location?: string; lat?: number; lng?: number }): Promise<ResolvedPlace | null> {
  if (input.lat !== undefined && input.lng !== undefined) {
    const nearest = await getJson<PostcodeResult[]>(`${api}/postcodes?lon=${input.lng}&lat=${input.lat}&limit=1&radius=2000`);
    const place = fromPostcode(nearest?.[0]);
    return place ? { ...place, lat: input.lat, lng: input.lng } : { name: "Shared location", lat: input.lat, lng: input.lng };
  }

  const text = input.location?.trim();
  if (!text) return null;
  const postcode = text.match(postcodePattern);
  if (postcode) {
    const place = fromPostcode(await getJson<PostcodeResult>(`${api}/postcodes/${encodeURIComponent(`${postcode[1]} ${postcode[2]}`.toUpperCase())}`));
    if (place) return place;
  }

  // In "1 High Street, Hinckley, Leicestershire" the town is usually the first part without a house number.
  // A mistyped or retired postcode falls back to the town written next to it.
  const towns = text.replace(postcodePattern, "").split(",").map((part) => part.trim()).filter((part) => part && !/\d/.test(part)).slice(0, 3);
  for (const town of towns) {
    const [match] = (await getJson<PlaceResult[]>(`${api}/places?q=${encodeURIComponent(town)}&limit=1`)) ?? [];
    if (match) {
      return {
        name: match.name_1,
        district: match.district_borough ?? match.county_unitary ?? undefined,
        county: match.county_unitary ?? match.region ?? undefined,
        lat: match.latitude,
        lng: match.longitude,
      };
    }
  }
  return null;
}

export function placeLabel(place: ResolvedPlace) {
  return [place.name, place.county].filter(Boolean).filter((part, index, parts) => parts.indexOf(part) === index).join(", ");
}
