import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getArea } from "@/lib/areas";
import { redisFromEnv, type Redis } from "@/lib/redis";
import type { AreaContent, WaitlistEntry } from "@/lib/types";

// Content lives in one JSON document per area (seeded from data/<area>-*.json on first use)
// plus one waitlist document shared by all areas.
export type ContentStore = {
  read(areaId: string): Promise<AreaContent>;
  update<R>(areaId: string, change: (content: AreaContent) => R | Promise<R>): Promise<R>;
  readWaitlist(): Promise<WaitlistEntry[]>;
  updateWaitlist<R>(change: (entries: WaitlistEntry[]) => R | Promise<R>): Promise<R>;
};

export class StorageUnavailableError extends Error {}

const waitlistName = "_waitlist";

function areaFallback(areaId: string) {
  const area = getArea(areaId);
  if (!area) throw new Error(`Unknown area: ${areaId}`);
  return (): AreaContent => ({ places: area.seedPlaces, events: area.seedEvents, updates: [], reviews: [], enquiries: [] });
}

type DocumentBackend = {
  read<T>(name: string, fallback: () => T): Promise<T>;
  update<T, R>(name: string, fallback: () => T, change: (value: T) => R | Promise<R>): Promise<R>;
};

function storeOn(backend: DocumentBackend): ContentStore {
  return {
    async read(areaId) {
      return backend.read(areaId, areaFallback(areaId));
    },
    async update<R>(areaId: string, change: (content: AreaContent) => R | Promise<R>) {
      return backend.update<AreaContent, R>(areaId, areaFallback(areaId), change);
    },
    readWaitlist() {
      return backend.read<WaitlistEntry[]>(waitlistName, () => []);
    },
    updateWaitlist<R>(change: (entries: WaitlistEntry[]) => R | Promise<R>) {
      return backend.update<WaitlistEntry[], R>(waitlistName, () => [], change);
    },
  };
}

// Local development and single-server hosting with a persistent disk.
export function createContentStore(directory: string): ContentStore {
  const queues = new Map<string, Promise<unknown>>();

  async function read<T>(name: string, fallback: () => T): Promise<T> {
    try {
      return JSON.parse(await readFile(path.join(directory, `${name}.json`), "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return fallback();
    }
  }

  async function write(name: string, value: unknown) {
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${name}.json`);
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2));
    await rename(temporary, file);
  }

  // Writes to one document run one at a time so concurrent requests can't drop each other's changes.
  function update<T, R>(name: string, fallback: () => T, change: (value: T) => R | Promise<R>): Promise<R> {
    const previous = queues.get(name) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      const value = await read(name, fallback);
      const result = await change(value);
      await write(name, value);
      return result;
    });
    queues.set(name, next);
    return next;
  }

  return storeOn({ read, update });
}

// Each document has a version counter; a write only lands if nobody else wrote since we read.
const compareAndSet = `
local current = redis.call('GET', KEYS[2])
if (current or '0') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('INCR', KEYS[2])
return 1`;

// Production on serverless or multi-instance hosting.
export function createRedisStore(redis: Redis, prefix = "near-to-me", maxAttempts = 8): ContentStore {
  const keys = (name: string) => [`${prefix}:doc:${name}`, `${prefix}:ver:${name}`];

  async function load<T>(name: string, fallback: () => T) {
    const [docKey, versionKey] = keys(name);
    const [raw, version] = await redis.pipeline([["GET", docKey], ["GET", versionKey]]) as [string | null, string | null];
    return { value: raw ? JSON.parse(raw) as T : fallback(), version: version ?? "0" };
  }

  return storeOn({
    read: async (name, fallback) => (await load(name, fallback)).value,
    async update(name, fallback, change) {
      const [docKey, versionKey] = keys(name);
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const { value, version } = await load(name, fallback);
        const result = await change(value);
        const saved = await redis.command<number>(["EVAL", compareAndSet, 2, docKey, versionKey, version, JSON.stringify(value)]);
        if (saved === 1) return result;
        await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60 * (attempt + 1)));
      }
      throw new Error(`Gave up saving ${name} after ${maxAttempts} conflicting writes.`);
    },
  });
}

// Serverless hosting without a database: the site still shows the built-in listings, but nothing can be saved.
export function createReadOnlyStore(reason: string): ContentStore {
  const refuse = async (): Promise<never> => { throw new StorageUnavailableError(reason); };
  return storeOn({ read: async (_name, fallback) => fallback(), update: refuse });
}

function storeFromEnv(): ContentStore {
  const redis = redisFromEnv();
  if (redis) return createRedisStore(redis, process.env.STORE_PREFIX ?? "near-to-me");
  if (process.env.VERCEL) return createReadOnlyStore("Saving is turned off: connect an Upstash Redis database (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).");
  return createContentStore(process.env.CONTENT_DIR ?? path.join(process.cwd(), ".data"));
}

export const contentStore = storeFromEnv();
