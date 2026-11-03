import { describe, expect, it } from "vitest";
import { checkCredentials, parseAdminUsers, sessionHours, signSession, verifySession } from "@/lib/admin-auth";

const secret = "a".repeat(40);

describe("parseAdminUsers", () => {
  it("reads name:password pairs and ignores malformed entries", () => {
    const users = parseAdminUsers("Sam:one-pass, Priya:two:with:colons,broken,:nopass");
    expect([...users.entries()]).toEqual([["sam", "one-pass"], ["priya", "two:with:colons"]]);
  });

  it("returns no users when unset", () => {
    expect(parseAdminUsers(undefined).size).toBe(0);
  });
});

describe("checkCredentials", () => {
  const users = parseAdminUsers("Sam:correct-horse");

  it("accepts the right password with a case-insensitive name", () => {
    expect(checkCredentials(users, " SAM ", "correct-horse")).toBe(true);
  });

  it("rejects a wrong password or unknown name", () => {
    expect(checkCredentials(users, "Sam", "wrong")).toBe(false);
    expect(checkCredentials(users, "Alex", "correct-horse")).toBe(false);
  });
});

describe("sessions", () => {
  const now = Date.parse("2026-11-03T12:00:00Z");

  it("round-trips a signed session", () => {
    expect(verifySession(signSession("Sam", secret, now), secret, now)).toBe("Sam");
  });

  it("rejects tampered, foreign and expired sessions", () => {
    const token = signSession("Sam", secret, now);
    const [payload, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ name: "Mallory", exp: now + 1e9 })).toString("base64url");
    expect(verifySession(`${forged}.${mac}`, secret, now)).toBeNull();
    expect(verifySession(`${payload}.${mac}x`, secret, now)).toBeNull();
    expect(verifySession(token, "b".repeat(40), now)).toBeNull();
    expect(verifySession(token, secret, now + sessionHours * 3_600_000 + 1)).toBeNull();
    expect(verifySession(undefined, secret, now)).toBeNull();
    expect(verifySession("garbage", secret, now)).toBeNull();
  });
});
