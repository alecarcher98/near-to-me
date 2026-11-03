import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getArea } from "@/lib/areas";
import type { AreaContent } from "@/lib/types";

// File-backed store: one JSON document per area, seeded from data/<area>-*.json on first use.
// Swap this module for a hosted database before running more than one server instance.
export function createContentStore(directory: string) {
  const queues = new Map<string, Promise<unknown>>();

  function fileFor(areaId: string) {
    if (!getArea(areaId)) throw new Error(`Unknown area: ${areaId}`);
    return path.join(directory, `${areaId}.json`);
  }

  async function read(areaId: string): Promise<AreaContent> {
    const area = getArea(areaId);
    if (!area) throw new Error(`Unknown area: ${areaId}`);
    try {
      return JSON.parse(await readFile(fileFor(areaId), "utf8")) as AreaContent;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { places: area.seedPlaces, events: area.seedEvents, updates: [], reviews: [], enquiries: [] };
    }
  }

  async function write(areaId: string, content: AreaContent) {
    await mkdir(directory, { recursive: true });
    const file = fileFor(areaId);
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(content, null, 2));
    await rename(temporary, file);
  }

  // Writes for one area run one at a time so concurrent requests can't drop each other's changes.
  function update<T>(areaId: string, change: (content: AreaContent) => T | Promise<T>): Promise<T> {
    const previous = queues.get(areaId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      const content = await read(areaId);
      const result = await change(content);
      await write(areaId, content);
      return result;
    });
    queues.set(areaId, next);
    return next;
  }

  return { read, update };
}

export const contentStore = createContentStore(process.env.CONTENT_DIR ?? path.join(process.cwd(), ".data"));
