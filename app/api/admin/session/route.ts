import { NextResponse, type NextRequest } from "next/server";
import { adminConfig, adminCookieName, checkCredentials, currentAdmin, sessionHours, signSession } from "@/lib/admin-auth";
import { isSameOrigin, jsonError, readJson } from "@/lib/http";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const allowLogin = createRateLimiter(8, 15 * 60_000);

export async function GET(request: NextRequest) {
  return NextResponse.json({ enabled: adminConfig().enabled, admin: currentAdmin(request.cookies.get(adminCookieName)?.value) });
}

export async function POST(request: NextRequest) {
  const { enabled, secret, users } = adminConfig();
  if (!enabled) return jsonError("Admin sign-in isn't set up on this server yet. Set ADMIN_USERS and ADMIN_SESSION_SECRET.", 503);
  if (!isSameOrigin(request)) return jsonError("Sign in from this site.", 403);
  if (!allowLogin(clientKey(request.headers))) return jsonError("Too many sign-in attempts. Wait 15 minutes and try again.", 429);
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const { name, password } = json.body;
  if (typeof name !== "string" || typeof password !== "string" || !checkCredentials(users, name, password)) {
    return jsonError("That name and password don't match an admin account.", 401);
  }
  const response = NextResponse.json({ admin: name.trim() });
  response.cookies.set(adminCookieName, signSession(name.trim(), secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionHours * 3600,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Sign out from this site.", 403);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(adminCookieName);
  return response;
}
