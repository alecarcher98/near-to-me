// In-memory, per-instance limiter for public form posts.
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now = Date.now()) {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

export function clientKey(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
