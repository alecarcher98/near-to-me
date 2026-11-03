import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { areas } from "@/lib/areas";
import { createReadOnlyStore, createRedisStore, StorageUnavailableError } from "@/lib/content-store";
import { isSameOrigin, readJson, route } from "@/lib/http";
import { clientKey, createMemoryRateLimiter, createRedisRateLimiter } from "@/lib/rate-limit";
import type { Redis, RedisArg } from "@/lib/redis";
import { isEmail, parseUpdate } from "@/lib/validation";

// In-memory stand-in for Upstash covering the commands the app uses, including the compare-and-set script.
function fakeRedis() {
  const data = new Map<string, string>();
  const expiries = new Map<string, number>();
  let clock = 0;
  const run = (args: RedisArg[]): unknown => {
    const [command, ...rest] = args.map(String);
    for (const [key, at] of expiries) if (at <= clock) { data.delete(key); expiries.delete(key); }
    switch (command) {
      case "GET": return data.get(rest[0]) ?? null;
      case "SET": {
        const [key, value, ...options] = rest;
        if (options.includes("NX") && data.has(key)) return null;
        data.set(key, value);
        const ex = options.indexOf("EX");
        if (ex >= 0) expiries.set(key, clock + Number(options[ex + 1]) * 1000);
        return "OK";
      }
      case "INCR": {
        const next = Number(data.get(rest[0]) ?? 0) + 1;
        data.set(rest[0], String(next));
        return next;
      }
      case "EVAL": {
        const [, , docKey, versionKey, expected, value] = rest;
        if ((data.get(versionKey) ?? "0") !== expected) return 0;
        data.set(docKey, value);
        data.set(versionKey, String(Number(data.get(versionKey) ?? 0) + 1));
        return 1;
      }
      default: throw new Error(`Unsupported command ${command}`);
    }
  };
  const redis: Redis = {
    command: async <T,>(args: RedisArg[]) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));
      return run(args) as T;
    },
    pipeline: async (commands) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));
      return commands.map(run);
    },
  };
  return { redis, data, advance: (ms: number) => { clock += ms; } };
}

describe("Redis content store", () => {
  it("starts from seed data and persists changes", async () => {
    const { redis } = fakeRedis();
    const store = createRedisStore(redis, "test");
    expect((await store.read("nuneaton")).places).toHaveLength(areas.nuneaton.seedPlaces.length);
    await store.update("nuneaton", (content) => { content.places = content.places.slice(0, 3); });
    expect((await createRedisStore(redis, "test").read("nuneaton")).places).toHaveLength(3);
  });

  it("never loses a write when instances save at the same time", async () => {
    const { redis } = fakeRedis();
    const instances = [createRedisStore(redis, "test", 50), createRedisStore(redis, "test", 50), createRedisStore(redis, "test", 50)];
    await Promise.all(Array.from({ length: 15 }, (_, index) => instances[index % 3].updateWaitlist((entries) => {
      entries.push({ id: `w${index}`, email: `p${index}@example.com`, location: "Hinckley", source: "signup", createdAt: "2026-11-03" });
    })));
    expect((await instances[0].readWaitlist()).map((entry) => entry.id).sort()).toHaveLength(15);
  });

  it("gives up rather than overwriting when it keeps losing the race", async () => {
    const { redis } = fakeRedis();
    const store = createRedisStore(redis, "test", 2);
    await expect(store.updateWaitlist(async () => {
      await redis.command(["INCR", "test:ver:_waitlist"]);
    })).rejects.toThrow("conflicting writes");
  });

  it("refuses unknown areas", async () => {
    await expect(createRedisStore(fakeRedis().redis).read("../etc")).rejects.toThrow("Unknown area");
  });
});

describe("read-only store", () => {
  it("serves seed data but refuses writes", async () => {
    const store = createReadOnlyStore("no database");
    expect((await store.read("nuneaton")).events).toHaveLength(areas.nuneaton.seedEvents.length);
    await expect(store.update("nuneaton", () => undefined)).rejects.toBeInstanceOf(StorageUnavailableError);
  });

  it("turns refused writes into a 503 without leaking details", async () => {
    const handler = route(async () => { throw new StorageUnavailableError("UPSTASH token missing"); });
    const response = await handler();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("UPSTASH");
  });

  it("turns unexpected errors into a generic 500", async () => {
    const response = await route(async () => { throw new Error("secret stack detail"); })();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});

describe("rate limiting", () => {
  it("allows up to the limit per key within the window", async () => {
    let now = 0;
    const allow = createMemoryRateLimiter(2, 1000, () => now);
    expect([await allow("a"), await allow("a"), await allow("a"), await allow("b")]).toEqual([true, true, false, true]);
    now = 1001;
    expect(await allow("a")).toBe(true);
  });

  it("shares limits across instances through Redis", async () => {
    const { redis, advance } = fakeRedis();
    const first = createRedisRateLimiter(redis, "login", 2, 60_000);
    const second = createRedisRateLimiter(redis, "login", 2, 60_000);
    expect([await first("ip"), await second("ip"), await first("ip")]).toEqual([true, true, false]);
    advance(60_001);
    expect(await second("ip")).toBe(true);
  });

  it("prefers the proxy-set client address", () => {
    expect(clientKey(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "6.6.6.6, 1.1.1.1" }))).toBe("1.1.1.1");
    expect(clientKey(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
  });
});

describe("request parsing", () => {
  const post = (body: BodyInit, headers: Record<string, string>) => new NextRequest("http://localhost:3000/api/x", { method: "POST", body, headers: { host: "localhost:3000", ...headers } });

  it("only accepts JSON bodies", async () => {
    const result = await readJson(post("a=1", { "content-type": "application/x-www-form-urlencoded" }));
    expect(!result.ok && result.response.status).toBe(415);
  });

  it("stops reading oversized bodies even without a content-length", async () => {
    const huge = new ReadableStream({ start(controller) { for (let i = 0; i < 30; i += 1) controller.enqueue(new TextEncoder().encode("x".repeat(1000))); controller.close(); } });
    const init = { method: "POST", body: huge, headers: { "content-type": "application/json" }, duplex: "half" };
    const request = new NextRequest("http://localhost:3000/api/x", init as ConstructorParameters<typeof NextRequest>[1]);
    const result = await readJson(request);
    expect(!result.ok && result.response.status).toBe(413);
  });

  it("rejects arrays and invalid JSON", async () => {
    expect((await readJson(post("[1]", { "content-type": "application/json" }))).ok).toBe(false);
    expect((await readJson(post("{", { "content-type": "application/json" }))).ok).toBe(false);
  });

  it("checks the Origin header against SITE_URL when set", () => {
    const request = post("{}", { origin: "https://near-to-me.example", "content-type": "application/json" });
    process.env.SITE_URL = "https://near-to-me.example";
    expect(isSameOrigin(request)).toBe(true);
    process.env.SITE_URL = "https://other.example";
    expect(isSameOrigin(request)).toBe(false);
    delete process.env.SITE_URL;
  });
});

describe("input validation", () => {
  it.each(["sam@example.com", "first.last+tag@sub.example.co.uk"])("accepts %s", (email) => {
    expect(isEmail(email)).toBe(true);
  });

  it.each(["a@b", "x@example.com?cc=evil@example.com", "x@example.com&body=hi", "x,y@example.com", "<x>@example.com", "x@example.com\nBcc: y@example.com"])("rejects %s", (email) => {
    expect(isEmail(email)).toBe(false);
  });

  it("only allows http and https links", () => {
    expect(parseUpdate({ title: "t", body: "b", link: "javascript:alert(1)" }).ok).toBe(false);
    expect(parseUpdate({ title: "t", body: "b", link: "data:text/html,hi" }).ok).toBe(false);
    expect(parseUpdate({ title: "t", body: "b", link: "http://localhost" }).ok).toBe(false);
    expect(parseUpdate({ title: "t", body: "b", link: "https://example.com/page" }).ok).toBe(true);
  });
});
