import { NextResponse, type NextRequest } from "next/server";
import { defaultAreaId, getArea } from "@/lib/areas";
import { contentStore } from "@/lib/content-store";
import { jsonError, route } from "@/lib/http";
import type { PublicContent } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async (request: NextRequest) => {
  const areaId = request.nextUrl.searchParams.get("area") ?? defaultAreaId;
  if (!getArea(areaId)) return jsonError("Unknown area.", 404);
  const { places, events, updates, reviews } = await contentStore.read(areaId);
  const now = Date.now();
  const content: PublicContent = {
    places,
    events,
    updates: updates.filter((update) => !update.expiresAt || Date.parse(update.expiresAt) > now),
    reviews,
  };
  // Brief shared caching keeps traffic spikes off the database; admin edits show within a minute.
  return NextResponse.json(content, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } });
});
