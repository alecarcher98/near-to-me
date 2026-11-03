import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { areas } from "@/lib/areas";
import { createContentStore } from "@/lib/content-store";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "near-to-me-store-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("content store", () => {
  it("starts from the area's seed data", async () => {
    const content = await createContentStore(directory).read("nuneaton");
    expect(content.places).toHaveLength(areas.nuneaton.seedPlaces.length);
    expect(content.events).toHaveLength(areas.nuneaton.seedEvents.length);
    expect(content.updates).toEqual([]);
  });

  it("persists changes to disk", async () => {
    const store = createContentStore(directory);
    await store.update("nuneaton", (content) => { content.places = content.places.slice(1); });
    const saved = JSON.parse(await readFile(path.join(directory, "nuneaton.json"), "utf8"));
    expect(saved.places).toHaveLength(areas.nuneaton.seedPlaces.length - 1);
    expect((await createContentStore(directory).read("nuneaton")).places).toHaveLength(areas.nuneaton.seedPlaces.length - 1);
  });

  it("keeps every change when updates overlap", async () => {
    const store = createContentStore(directory);
    await Promise.all(Array.from({ length: 10 }, (_, index) => store.update("nuneaton", async (content) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
      content.updates.push({ id: `u${index}`, kind: "update", title: `Update ${index}`, body: "b", postedAt: new Date().toISOString() });
    })));
    expect((await store.read("nuneaton")).updates).toHaveLength(10);
  });

  it("carries on after a failed update", async () => {
    const store = createContentStore(directory);
    await expect(store.update("nuneaton", () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await store.update("nuneaton", (content) => { content.updates.push({ id: "ok", kind: "update", title: "t", body: "b", postedAt: "2026-11-03" }); });
    expect((await store.read("nuneaton")).updates.map((update) => update.id)).toEqual(["ok"]);
  });

  it("refuses unknown areas", async () => {
    await expect(createContentStore(directory).read("../secrets")).rejects.toThrow("Unknown area");
  });
});
