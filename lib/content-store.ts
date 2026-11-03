import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getArea } from "@/lib/areas";
import type { AreaContent, WaitlistEntry } from "@/lib/types";

// File-backed store: one JSON document per area (seeded from data/<area>-*.json on first use)
// plus one waitlist shared by all areas.
// Swap this module for a hosted database before running on serverless hosting or more than one instance.
export function createContentStore(directory: string) {
  const queues = new Map<string, Promise<unknown>>();
  const waitlistFile = "_waitlist";

  async function readDocument<T>(name: string, fallback: () => T): Promise<T> {
    try {
      return JSON.parse(await readFile(path.join(directory, `${name}.json`), "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return fallback();
    }
  }

  async function writeDocument(name: string, value: unknown) {
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${name}.json`);
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2));
    await rename(temporary, file);
  }

  // Writes to one document run one at a time so concurrent requests can't drop each other's changes.
  function updateDocument<T, R>(name: string, fallback: () => T, change: (value: T) => R | Promise<R>): Promise<R> {
    const previous = queues.get(name) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      const value = await readDocument(name, fallback);
      const result = await change(value);
      await writeDocument(name, value);
      return result;
    });
    queues.set(name, next);
    return next;
  }

  function areaFallback(areaId: string) {
    const area = getArea(areaId);
    if (!area) throw new Error(`Unknown area: ${areaId}`);
    return (): AreaContent => ({ places: area.seedPlaces, events: area.seedEvents, updates: [], reviews: [], enquiries: [] });
  }

  return {
    read: async (areaId: string) => readDocument(areaId, areaFallback(areaId)),
    update: async <R>(areaId: string, change: (content: AreaContent) => R | Promise<R>) => updateDocument(areaId, areaFallback(areaId), change),
    readWaitlist: () => readDocument<WaitlistEntry[]>(waitlistFile, () => []),
    updateWaitlist: <R>(change: (entries: WaitlistEntry[]) => R | Promise<R>) => updateDocument<WaitlistEntry[], R>(waitlistFile, () => [], change),
  };
}

export const contentStore = createContentStore(process.env.CONTENT_DIR ?? path.join(process.cwd(), ".data"));
