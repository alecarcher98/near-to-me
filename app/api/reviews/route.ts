import { NextResponse, type NextRequest } from "next/server";
import { defaultAreaId, getArea } from "@/lib/areas";
import { contentStore } from "@/lib/content-store";
import { isSameOrigin, jsonError, readJson, route } from "@/lib/http";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { parseReview } from "@/lib/validation";

const allow = createRateLimiter("reviews", 5, 10 * 60_000);

export const POST = route(async (request: NextRequest) => {
  if (!isSameOrigin(request)) return jsonError("Reviews must be sent from this site.", 403);
  if (!(await allow(clientKey(request.headers)))) return jsonError("Too many reviews from here. Try again in a few minutes.", 429);
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const areaId = typeof json.body.area === "string" ? json.body.area : defaultAreaId;
  if (!getArea(areaId)) return jsonError("Unknown area.", 404);
  // Hidden field people never fill in; report success so bots don't retry.
  if (json.body.contactTime) return NextResponse.json({ ok: true }, { status: 201 });

  const result = await contentStore.update(areaId, (content) => {
    const parsed = parseReview(json.body, content.places);
    if (parsed.ok) content.reviews.unshift(parsed.value);
    return parsed;
  });
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({ review: result.value }, { status: 201 });
});
