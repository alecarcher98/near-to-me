import { NextResponse, type NextRequest } from "next/server";

const maxBodyBytes = 20_000;

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(request: NextRequest): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBodyBytes) return { ok: false, response: jsonError("That request is too large.", 413) };
  try {
    const text = await request.text();
    if (text.length > maxBodyBytes) return { ok: false, response: jsonError("That request is too large.", 413) };
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, response: jsonError("Send the details as a JSON object.", 400) };
    return { ok: true, body: body as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonError("Send the details as JSON.", 400) };
  }
}

// Rejects cross-site posts; browsers always send Origin on fetch POST/PUT/PATCH/DELETE.
export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}
