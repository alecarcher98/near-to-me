import { NextResponse, type NextRequest } from "next/server";
import { defaultAreaId, getArea } from "@/lib/areas";
import { contentStore } from "@/lib/content-store";
import { isSameOrigin, jsonError, readJson } from "@/lib/http";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { parseEnquiry } from "@/lib/validation";
import { recordInterest, type Coverage } from "@/lib/waitlist";

const allow = createRateLimiter(5, 10 * 60_000);

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Enquiries must be sent from this site.", 403);
  if (!allow(clientKey(request.headers))) return jsonError("Too many enquiries from here. Try again in a few minutes.", 429);
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const areaId = typeof json.body.area === "string" ? json.body.area : defaultAreaId;
  if (!getArea(areaId)) return jsonError("Unknown area.", 404);
  // Hidden field people never fill in; report success so bots don't retry.
  if (json.body.contactTime) return NextResponse.json({ ok: true }, { status: 201 });

  const parsed = parseEnquiry(json.body);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const enquiry = parsed.value;

  // Businesses outside every live area also join the coming-soon list for their location.
  let coverage: Coverage | undefined;
  if (enquiry.address) {
    coverage = await recordInterest({ email: enquiry.email, name: enquiry.contactName, location: enquiry.address, source: json.body.fromSignup === true ? "business-signup" : "enquiry", role: "business" }, { saveUnresolved: false });
    if (coverage.status === "coming-soon") enquiry.comingSoonFor = coverage.placeName;
  }
  await contentStore.update(areaId, (content) => { content.enquiries.unshift(enquiry); });
  return NextResponse.json({ ok: true, ...(enquiry.comingSoonFor ? { comingSoon: enquiry.comingSoonFor } : {}) }, { status: 201 });
}
