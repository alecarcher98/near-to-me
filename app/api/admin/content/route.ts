import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName, currentAdmin } from "@/lib/admin-auth";
import { defaultAreaId, getArea } from "@/lib/areas";
import { contentStore } from "@/lib/content-store";
import { isSameOrigin, jsonError, readJson } from "@/lib/http";
import type { AreaContent } from "@/lib/types";
import { parseEnquiryStatus, parseEvent, parsePlace, parseUpdate, type Parsed } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Editable = "places" | "events" | "updates";
const parsers: Record<Editable, (input: unknown) => Parsed<{ id: string }>> = { places: parsePlace, events: parseEvent, updates: parseUpdate };
const deletable: (keyof AreaContent)[] = ["places", "events", "updates", "reviews", "enquiries"];

function guard(request: NextRequest, mutating: boolean): { error: NextResponse } | { admin: string; areaId: string } {
  const admin = currentAdmin(request.cookies.get(adminCookieName)?.value);
  if (!admin) return { error: jsonError("Sign in as an admin first.", 401) };
  if (mutating && !isSameOrigin(request)) return { error: jsonError("Admin changes must come from this site.", 403) };
  const areaId = request.nextUrl.searchParams.get("area") ?? defaultAreaId;
  if (!getArea(areaId)) return { error: jsonError("Unknown area.", 404) };
  return { admin, areaId };
}

export async function GET(request: NextRequest) {
  const access = guard(request, false);
  if ("error" in access) return access.error;
  return NextResponse.json(await contentStore.read(access.areaId), { headers: { "cache-control": "no-store" } });
}

// Create or replace one place, event or update, matched by id.
export async function PUT(request: NextRequest) {
  const access = guard(request, true);
  if ("error" in access) return access.error;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const { collection, item } = json.body;
  if (typeof collection !== "string" || !Object.hasOwn(parsers, collection)) return jsonError("Choose places, events or updates.", 400);
  const parsed = parsers[collection as Editable](item);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  await contentStore.update(access.areaId, (content) => {
    const list = content[collection as Editable] as { id: string }[];
    const index = list.findIndex((existing) => existing.id === parsed.value.id);
    if (index >= 0) list[index] = parsed.value;
    else list.unshift(parsed.value);
  });
  return NextResponse.json({ item: parsed.value });
}

// Moves a business enquiry through new → in-progress → done.
export async function PATCH(request: NextRequest) {
  const access = guard(request, true);
  if ("error" in access) return access.error;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = parseEnquiryStatus(json.body);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const found = await contentStore.update(access.areaId, (content) => {
    const enquiry = content.enquiries.find((item) => item.id === parsed.value.id);
    if (enquiry) enquiry.status = parsed.value.status;
    return Boolean(enquiry);
  });
  return found ? NextResponse.json({ ok: true }) : jsonError("Enquiry not found.", 404);
}

export async function DELETE(request: NextRequest) {
  const access = guard(request, true);
  if ("error" in access) return access.error;
  const collection = request.nextUrl.searchParams.get("collection") as keyof AreaContent | null;
  const id = request.nextUrl.searchParams.get("id");
  if (!collection || !deletable.includes(collection) || !id) return jsonError("Say which item to remove.", 400);
  const removed = await contentStore.update(access.areaId, (content) => {
    const list = content[collection] as { id: string }[];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) list.splice(index, 1);
    return index >= 0;
  });
  return removed ? NextResponse.json({ ok: true }) : jsonError("Item not found.", 404);
}
