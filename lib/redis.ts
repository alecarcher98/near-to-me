// Minimal Upstash Redis REST client (works on serverless without a TCP connection or extra dependency).
// Configure with UPSTASH_REDIS_REST_URL/TOKEN, or the KV_REST_API_URL/TOKEN names Vercel's Upstash integration sets.
export type RedisArg = string | number;

export type Redis = {
  command<T = unknown>(args: RedisArg[]): Promise<T>;
  pipeline(commands: RedisArg[][]): Promise<unknown[]>;
};

export function redisFromEnv(env: NodeJS.ProcessEnv = process.env): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? createRestRedis(url, token) : null;
}

export function createRestRedis(url: string, token: string): Redis {
  async function send(path: string, body: unknown) {
    const response = await fetch(`${url.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json().catch(() => null) as unknown;
    if (!response.ok) throw new Error(`Redis request failed (${response.status}).`);
    return result;
  }

  return {
    async command<T>(args: RedisArg[]) {
      const { result, error } = await send("", args) as { result?: T; error?: string };
      if (error) throw new Error(`Redis error: ${error}`);
      return result as T;
    },
    async pipeline(commands: RedisArg[][]) {
      const replies = await send("/pipeline", commands) as { result?: unknown; error?: string }[];
      return replies.map((reply) => {
        if (reply.error) throw new Error(`Redis error: ${reply.error}`);
        return reply.result;
      });
    },
  };
}
