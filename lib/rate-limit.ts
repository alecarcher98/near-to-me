import { redisFromEnv, type Redis } from "@/lib/redis";

export type RateLimiter = (key: string) => Promise<boolean>;

// Per-instance fallback for local development.
export function createMemoryRateLimiter(limit: number, windowMs: number, now = () => Date.now()): RateLimiter {
  const hits = new Map<string, number[]>();
  return async (key) => {
    const time = now();
    const recent = (hits.get(key) ?? []).filter((hit) => time - hit < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(time);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return allowed;
  };
}

// Fixed window shared by every server instance.
export function createRedisRateLimiter(redis: Redis, name: string, limit: number, windowMs: number): RateLimiter {
  const seconds = Math.ceil(windowMs / 1000);
  return async (key) => {
    const bucket = `near-to-me:rate:${name}:${key}`;
    try {
      const [, count] = await redis.pipeline([["SET", bucket, 0, "EX", seconds, "NX"], ["INCR", bucket]]);
      return Number(count) <= limit;
    } catch (error) {
      // Fail open: a Redis outage shouldn't take the forms down; validation still applies.
      console.error("Rate limiter unavailable.", error);
      return true;
    }
  };
}

export function createRateLimiter(name: string, limit: number, windowMs: number): RateLimiter {
  const redis = redisFromEnv();
  return redis ? createRedisRateLimiter(redis, name, limit, windowMs) : createMemoryRateLimiter(limit, windowMs);
}

// Vercel and most proxies set x-real-ip themselves; x-forwarded-for's first hop can be supplied by the client.
export function clientKey(headers: Headers) {
  return headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
