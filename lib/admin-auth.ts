import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const adminCookieName = "ntm_admin";
export const sessionHours = 12;

// ADMIN_USERS="Sam:long-password,Priya:another-password"
export function parseAdminUsers(value: string | undefined) {
  const users = new Map<string, string>();
  for (const entry of (value ?? "").split(",")) {
    const separator = entry.indexOf(":");
    if (separator < 1) continue;
    const name = entry.slice(0, separator).trim();
    const password = entry.slice(separator + 1).trim();
    if (name && password) users.set(name.toLowerCase(), password);
  }
  return users;
}

function sameText(a: string, b: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

export function checkCredentials(users: Map<string, string>, name: string, password: string) {
  const expected = users.get(name.trim().toLowerCase());
  // Compare against a dummy when the user is unknown so timing doesn't reveal valid names.
  const matches = sameText(password, expected ?? "\u0000no-such-admin");
  return Boolean(expected) && matches;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(name: string, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ name, exp: now + sessionHours * 3_600_000 })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()) {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac || !sameText(mac, signature(payload, secret))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as { name?: unknown; exp?: unknown };
    return typeof session.name === "string" && typeof session.exp === "number" && session.exp > now ? session.name : null;
  } catch {
    return null;
  }
}

export function adminConfig() {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const users = parseAdminUsers(process.env.ADMIN_USERS);
  return { secret, users, enabled: secret.length >= 32 && users.size > 0 };
}

export function currentAdmin(cookieValue: string | undefined) {
  const { secret, enabled } = adminConfig();
  return enabled ? verifySession(cookieValue, secret) : null;
}
