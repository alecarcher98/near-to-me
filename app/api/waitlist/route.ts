import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, jsonError, readJson, route } from "@/lib/http";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { parseInterest } from "@/lib/validation";
import { recordInterest } from "@/lib/waitlist";

const allow = createRateLimiter("waitlist", 10, 10 * 60_000);

export const POST = route(async (request: NextRequest) => {
  if (!isSameOrigin(request)) return jsonError("Sign-ups must be sent from this site.", 403);
  if (!(await allow(clientKey(request.headers)))) return jsonError("Too many sign-ups from here. Try again in a few minutes.", 429);
  const json = await readJson(request);
  if (!json.ok) return json.response;
  // Hidden field people never fill in; report success so bots don't retry.
  if (json.body.contactTime) return NextResponse.json({ status: "unknown", placeName: "your area" }, { status: 201 });
  const parsed = parseInterest(json.body);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  return NextResponse.json(await recordInterest(parsed.value), { status: 201 });
});
