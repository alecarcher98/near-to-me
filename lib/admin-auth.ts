import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

export const sessionHours = 12;

// The __Host- prefix makes browsers refuse the cookie unless it's Secure, host-only and path=/.
export function adminCookieName(production = process.env.NODE_ENV === "production") {
  return production ? "__Host-ntm_admin" : "ntm_admin";
}

// ADMIN_USERS="Sam:scrypt:16384:8:1:<salt>:<hash>,Priya:scrypt:..." (create with `npm run admin:hash`).
// Plain-text passwords are accepted only outside production.
export function parseAdminUsers(value: string | undefined) {
  const users = new Map<string, string>();
  for (const entry of (value ?? "").split(",")) {
    const separator = entry.indexOf(":");
    if (separator < 1) continue;
    const name = entry.slice(0, separator).trim();
    const credential = entry.slice(separator + 1).trim();
    if (name && credential) users.set(name.toLowerCase(), credential);
  }
  return users;
}

export function isHashed(credential: string) {
  return credential.startsWith("scrypt:");
}

export async function hashPassword(password: string, cost = 16384) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 32, { N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${cost}:8:1:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

async function matchesCredential(password: string, credential: string) {
  if (!isHashed(credential)) return sameText(password, credential);
  const [, cost, blockSize, parallel, salt, hash] = credential.split(":");
  const expected = Buffer.from(hash ?? "", "base64url");
  if (expected.length !== 32) return false;
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt ?? "", "base64url"), 32, { N: Number(cost), r: Number(blockSize), p: Number(parallel), maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, expected);
}

function sameText(a: string, b: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

// Used for unknown names so a wrong name takes as long as a wrong password.
const decoyCredential = `scrypt:16384:8:1:${Buffer.alloc(16).toString("base64url")}:${Buffer.alloc(32).toString("base64url")}`;

export async function checkCredentials(users: Map<string, string>, name: string, password: string) {
  const credential = users.get(name.trim().toLowerCase());
  const matches = await matchesCredential(password, credential ?? decoyCredential);
  return Boolean(credential) && matches;
}

// Sessions carry a fingerprint of the admin's stored credential, so changing a password signs them out everywhere.
function fingerprint(credential: string) {
  return createHash("sha256").update(credential).digest("base64url").slice(0, 16);
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(name: string, credential: string, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ name, exp: now + sessionHours * 3_600_000, f: fingerprint(credential) })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySession(token: string | undefined, users: Map<string, string>, secret: string, now = Date.now()) {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac || !sameText(mac, signature(payload, secret))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as { name?: unknown; exp?: unknown; f?: unknown };
    if (typeof session.name !== "string" || typeof session.exp !== "number" || session.exp <= now) return null;
    const credential = users.get(session.name.trim().toLowerCase());
    return credential && session.f === fingerprint(credential) ? session.name : null;
  } catch {
    return null;
  }
}

export function adminConfig(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.ADMIN_SESSION_SECRET ?? "";
  const users = parseAdminUsers(env.ADMIN_USERS);
  const production = env.NODE_ENV === "production";
  const problems = [
    users.size === 0 && "ADMIN_USERS is not set",
    secret.length < 32 && "ADMIN_SESSION_SECRET must be at least 32 characters",
    production && [...users.values()].some((credential) => !isHashed(credential)) && "ADMIN_USERS must use hashed passwords in production (run npm run admin:hash)",
  ].filter((problem): problem is string => Boolean(problem));
  return { secret, users, enabled: problems.length === 0, problems };
}

export function currentAdmin(cookieValue: string | undefined) {
  const { secret, users, enabled } = adminConfig();
  return enabled ? verifySession(cookieValue, users, secret) : null;
}
