import { NextResponse, type NextRequest } from "next/server";
import { adminConfig, adminCookieName, checkCredentials, currentAdmin, sessionHours, signSession } from "@/lib/admin-auth";
import { isSameOrigin, jsonError, readJson, route } from "@/lib/http";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Limits per address and per account name, so spreading guesses across addresses doesn't help.
const allowFromAddress = createRateLimiter("login-ip", 8, 15 * 60_000);
const allowForName = createRateLimiter("login-name", 10, 15 * 60_000);

export const GET = route(async (request: NextRequest) => {
  const { enabled, problems } = adminConfig();
  if (!enabled) console.error(`Admin sign-in disabled: ${problems.join("; ")}.`);
  return NextResponse.json({ enabled, admin: currentAdmin(request.cookies.get(adminCookieName())?.value) }, { headers: { "cache-control": "no-store" } });
});

export const POST = route(async (request: NextRequest) => {
  const { enabled, secret, users } = adminConfig();
  if (!enabled) return jsonError("Admin sign-in isn't set up on this server yet.", 503);
  if (!isSameOrigin(request)) return jsonError("Sign in from this site.", 403);
  if (!(await allowFromAddress(clientKey(request.headers)))) return jsonError("Too many sign-in attempts. Wait 15 minutes and try again.", 429);
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const { name, password } = json.body;
  if (typeof name !== "string" || typeof password !== "string" || name.length > 80 || password.length > 200) {
    return jsonError("That name and password don't match an admin account.", 401);
  }
  if (!(await allowForName(name.trim().toLowerCase()))) return jsonError("Too many sign-in attempts. Wait 15 minutes and try again.", 429);
  if (!(await checkCredentials(users, name, password))) return jsonError("That name and password don't match an admin account.", 401);

  const credential = users.get(name.trim().toLowerCase())!;
  const response = NextResponse.json({ admin: name.trim() });
  response.cookies.set(adminCookieName(), signSession(name.trim(), credential, secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionHours * 3600,
  });
  return response;
});

export const DELETE = route(async (request: NextRequest) => {
  if (!isSameOrigin(request)) return jsonError("Sign out from this site.", 403);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName(), "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
});
