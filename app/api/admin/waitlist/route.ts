import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { contentStore } from "@/lib/content-store";
import { jsonError, readJson } from "@/lib/http";
import { parseWaitlistNotified } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = requireAdmin(request, false);
  if ("error" in access) return access.error;
  return NextResponse.json({ entries: await contentStore.readWaitlist() }, { headers: { "cache-control": "no-store" } });
}

// Marks people as emailed (or not) once an admin has told them about their area.
export async function PATCH(request: NextRequest) {
  const access = requireAdmin(request, true);
  if ("error" in access) return access.error;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = parseWaitlistNotified(json.body);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const ids = new Set(parsed.value.ids);
  const updated = await contentStore.updateWaitlist((entries) => {
    let count = 0;
    for (const entry of entries) {
      if (!ids.has(entry.id)) continue;
      if (parsed.value.notified) entry.notifiedAt = new Date().toISOString();
      else delete entry.notifiedAt;
      count += 1;
    }
    return count;
  });
  return NextResponse.json({ updated });
}

export async function DELETE(request: NextRequest) {
  const access = requireAdmin(request, true);
  if ("error" in access) return access.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Say who to remove.", 400);
  const removed = await contentStore.updateWaitlist((entries) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index >= 0) entries.splice(index, 1);
    return index >= 0;
  });
  return removed ? NextResponse.json({ ok: true }) : jsonError("Not found.", 404);
}
