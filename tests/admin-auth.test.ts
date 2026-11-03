import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { adminConfig, adminCookieName, checkCredentials, hashPassword, isHashed, parseAdminUsers, sessionHours, signSession, verifySession } from "@/lib/admin-auth";

const secret = "a".repeat(40);

describe("parseAdminUsers", () => {
  it("reads name:credential pairs, keeping colons inside hashes", () => {
    const users = parseAdminUsers("Sam:one-pass, Priya:scrypt:16384:8:1:salt:hash,broken,:nopass");
    expect([...users.entries()]).toEqual([["sam", "one-pass"], ["priya", "scrypt:16384:8:1:salt:hash"]]);
  });

  it("returns no users when unset", () => {
    expect(parseAdminUsers(undefined).size).toBe(0);
  });
});

describe("password hashing", () => {
  it("verifies a hashed password and rejects a wrong one", async () => {
    const credential = await hashPassword("correct horse battery");
    expect(isHashed(credential)).toBe(true);
    expect(credential).not.toContain("correct horse");
    const users = new Map([["sam", credential]]);
    expect(await checkCredentials(users, " SAM ", "correct horse battery")).toBe(true);
    expect(await checkCredentials(users, "Sam", "wrong")).toBe(false);
    expect(await checkCredentials(users, "Alex", "correct horse battery")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("accepts output from npm run admin:hash", async () => {
    const line = execFileSync(process.execPath, ["scripts/hash-admin-password.mjs", "Sam"], { input: "a long enough password\n" }).toString().trim();
    const users = parseAdminUsers(line);
    expect(await checkCredentials(users, "Sam", "a long enough password")).toBe(true);
  });

  it("still accepts plain-text passwords for local development", async () => {
    expect(await checkCredentials(parseAdminUsers("Sam:dev-pass"), "sam", "dev-pass")).toBe(true);
  });
});

describe("adminConfig", () => {
  it("refuses plain-text passwords and short secrets in production", () => {
    expect(adminConfig({ NODE_ENV: "production", ADMIN_USERS: "Sam:plain", ADMIN_SESSION_SECRET: secret }).enabled).toBe(false);
    expect(adminConfig({ NODE_ENV: "production", ADMIN_USERS: "Sam:scrypt:16384:8:1:a:b", ADMIN_SESSION_SECRET: "short" }).enabled).toBe(false);
    expect(adminConfig({ NODE_ENV: "production", ADMIN_USERS: "Sam:scrypt:16384:8:1:a:b", ADMIN_SESSION_SECRET: secret }).enabled).toBe(true);
    expect(adminConfig({ NODE_ENV: "development", ADMIN_USERS: "Sam:plain", ADMIN_SESSION_SECRET: secret }).enabled).toBe(true);
  });

  it("uses a __Host- cookie in production", () => {
    expect(adminCookieName(true)).toBe("__Host-ntm_admin");
    expect(adminCookieName(false)).toBe("ntm_admin");
  });
});

describe("sessions", () => {
  const now = Date.parse("2026-11-03T12:00:00Z");
  const users = new Map([["sam", "credential-one"]]);

  it("round-trips a signed session", () => {
    expect(verifySession(signSession("Sam", "credential-one", secret, now), users, secret, now)).toBe("Sam");
  });

  it("rejects tampered, foreign and expired sessions", () => {
    const token = signSession("Sam", "credential-one", secret, now);
    const [payload, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ name: "Mallory", exp: now + 1e9 })).toString("base64url");
    expect(verifySession(`${forged}.${mac}`, users, secret, now)).toBeNull();
    expect(verifySession(`${payload}.${mac}x`, users, secret, now)).toBeNull();
    expect(verifySession(token, users, "b".repeat(40), now)).toBeNull();
    expect(verifySession(token, users, secret, now + sessionHours * 3_600_000 + 1)).toBeNull();
    expect(verifySession(undefined, users, secret, now)).toBeNull();
    expect(verifySession("garbage", users, secret, now)).toBeNull();
  });

  it("signs people out when their password changes or they're removed", () => {
    const token = signSession("Sam", "credential-one", secret, now);
    expect(verifySession(token, new Map([["sam", "credential-two"]]), secret, now)).toBeNull();
    expect(verifySession(token, new Map(), secret, now)).toBeNull();
  });
});
