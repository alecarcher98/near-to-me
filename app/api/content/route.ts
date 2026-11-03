import { NextResponse, type NextRequest } from "next/server";
import { defaultAreaId, getArea } from "@/lib/areas";
import { contentStore } from "@/lib/content-store";
import { jsonError } from "@/lib/http";
import type { PublicContent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
  return NextResponse.json(content, { headers: { "cache-control": "no-store" } });
}
