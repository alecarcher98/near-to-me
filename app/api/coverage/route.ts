import { NextResponse, type NextRequest } from "next/server";
import { jsonError, route } from "@/lib/http";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { checkCoverage } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

// Each check makes up to four postcodes.io lookups, so keep it from being used as a free proxy.
const allow = createRateLimiter("coverage", 60, 10 * 60_000);

// Tells the Explore page whether a location is covered yet. Nothing is saved.
export const GET = route(async (request: NextRequest) => {
  if (!(await allow(clientKey(request.headers)))) return jsonError("Too many location checks. Try again in a few minutes.", 429);
  const params = request.nextUrl.searchParams;
  const location = params.get("location")?.trim().slice(0, 120) || undefined;
  const lat = params.has("lat") ? Number(params.get("lat")) : undefined;
  const lng = params.has("lng") ? Number(params.get("lng")) : undefined;
  const hasPoint = lat !== undefined && lng !== undefined;
  if (hasPoint && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) return jsonError("Send a valid position.", 400);
  if (!location && !hasPoint) return jsonError("Send a town, postcode or position.", 400);
  return NextResponse.json(await checkCoverage(hasPoint ? { lat, lng } : { location }), { headers: { "cache-control": "no-store" } });
});
