import { NextResponse, type NextRequest } from "next/server";
import { StorageUnavailableError } from "@/lib/content-store";

const maxBodyBytes = 20_000;

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Wraps a route handler so unexpected failures are logged here and never leak details to the client.
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<NextResponse>) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        console.error(error.message);
        return jsonError("Saving isn't available right now. Please try again later.", 503);
      }
      console.error("Unhandled API error.", error);
      return jsonError("Something went wrong on our side. Please try again.", 500);
    }
  };
}

async function readCapped(request: NextRequest) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Only JSON is accepted: browsers can't send it cross-site without a CORS preflight, which this site never allows.
export async function readJson(request: NextRequest): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: jsonError("Send the details as JSON.", 415) };
  }
  if (Number(request.headers.get("content-length") ?? 0) > maxBodyBytes) return { ok: false, response: jsonError("That request is too large.", 413) };
  const text = await readCapped(request);
  if (text === null) return { ok: false, response: jsonError("That request is too large.", 413) };
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, response: jsonError("Send the details as a JSON object.", 400) };
    return { ok: true, body: body as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonError("Send the details as JSON.", 400) };
  }
}

// Rejects cross-site writes. Browsers always send Origin on fetch POST/PUT/PATCH/DELETE.
// Set SITE_URL in production so the check doesn't depend on proxy-supplied host headers.
export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const expected = process.env.SITE_URL ? new URL(process.env.SITE_URL).host : request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === expected;
  } catch {
    return false;
  }
}
