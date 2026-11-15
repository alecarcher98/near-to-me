import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { contentStore } from "@/lib/content-store";
import { jsonError, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const privateHeaders = { "cache-control": "no-store" };

// Everyone who signed up with their area and email. Main admins only.
export const GET = route(async (request: NextRequest) => {
  const access = requireAdmin(request, false, { owner: true });
  if ("error" in access) return access.error;
  return NextResponse.json({ members: await contentStore.readMembers() }, { headers: privateHeaders });
});

// Removes someone completely: their sign-up and any coming-soon entries under the same email (for deletion requests).
export const DELETE = route(async (request: NextRequest) => {
  const access = requireAdmin(request, true, { owner: true });
  if ("error" in access) return access.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Say who to remove.", 400);
  const email = await contentStore.updateMembers((members) => {
    const index = members.findIndex((member) => member.id === id);
    return index >= 0 ? members.splice(index, 1)[0].email : null;
  });
  if (!email) return jsonError("Not found.", 404);
  await contentStore.updateWaitlist((entries) => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].email === email) entries.splice(index, 1);
    }
  });
  console.info(`Admin ${access.admin} removed member ${id} and their coming-soon entries.`);
  return NextResponse.json({ ok: true }, { headers: privateHeaders });
});
