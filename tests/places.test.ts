import { describe, expect, it } from "vitest";
import { areas } from "@/lib/areas";
import { isSponsored, isSpotlight, matchesCategory, nearestByCategory, placeCategories, rankNearby, withDistance, type NearbyPlace } from "@/lib/places";
import type { Place } from "@/lib/types";

const now = Date.parse("2026-11-03T12:00:00Z");
const base: Place = { id: "x", name: "X", category: "Food", details: "", address: "", lat: 52.52, lng: -1.46 };

function nearby(overrides: Partial<NearbyPlace>): NearbyPlace {
  return { ...base, miles: 1, ...overrides };
}

describe("rankNearby", () => {
  it("puts just-opened places first, then sponsored, then nearest", () => {
    const ranked = rankNearby([
      nearby({ id: "near", miles: 0.1 }),
      nearby({ id: "sponsored", miles: 2, sponsored: true }),
      nearby({ id: "new", miles: 3, launchSpotlight: true, spotlightEndsAt: "2026-11-24T00:00:00Z" }),
      nearby({ id: "middle", miles: 0.5 }),
    ], now);
    expect(ranked.map((place) => place.id)).toEqual(["new", "sponsored", "near", "middle"]);
  });

  it("stops boosting once a spotlight or sponsorship has ended", () => {
    const ranked = rankNearby([
      nearby({ id: "old-spotlight", miles: 2, launchSpotlight: true, spotlightEndsAt: "2026-10-01T00:00:00Z" }),
      nearby({ id: "old-sponsor", miles: 3, sponsored: true, sponsoredUntil: "2026-10-01T00:00:00Z" }),
      nearby({ id: "near", miles: 1 }),
    ], now);
    expect(ranked.map((place) => place.id)).toEqual(["near", "old-spotlight", "old-sponsor"]);
  });

  it("does not mutate its input", () => {
    const input = [nearby({ id: "b", miles: 2 }), nearby({ id: "a", miles: 1 })];
    rankNearby(input, now);
    expect(input.map((place) => place.id)).toEqual(["b", "a"]);
  });
});

describe("spotlight and sponsorship", () => {
  it("needs an end date for a spotlight", () => {
    expect(isSpotlight({ ...base, launchSpotlight: true }, now)).toBe(false);
  });

  it("treats sponsorship without an end date as ongoing", () => {
    expect(isSponsored({ ...base, sponsored: true }, now)).toBe(true);
  });
});

describe("categories", () => {
  it("matches Healthy eats by tag rather than category", () => {
    expect(matchesCategory({ ...base, tags: ["healthy"] }, "Healthy eats")).toBe(true);
    expect(matchesCategory(base, "Healthy eats")).toBe(false);
    expect(matchesCategory(base, "Food")).toBe(true);
  });

  it("finds the nearest places in a category", () => {
    const places = withDistance([
      { ...base, id: "far", category: "Parking", lat: 52.6 },
      { ...base, id: "close", category: "Parking", lat: 52.521 },
      { ...base, id: "food", lat: 52.5201 },
    ], { lat: 52.52, lng: -1.46 });
    expect(nearestByCategory(places, "Parking", 1).map((place) => place.id)).toEqual(["close"]);
  });
});

describe("Nuneaton seed data", () => {
  const places = areas.nuneaton.seedPlaces;

  it("has unique ids", () => {
    expect(new Set(places.map((place) => place.id)).size).toBe(places.length);
  });

  it("gives every place real UK coordinates and a known category", () => {
    for (const place of places) {
      expect(place.lat, place.id).toBeGreaterThan(49);
      expect(place.lat, place.id).toBeLessThan(61);
      expect(place.lng, place.id).toBeGreaterThan(-9);
      expect(place.lng, place.id).toBeLessThan(2.5);
      expect(placeCategories, place.id).toContain(place.category);
    }
  });

  it("includes gyms and high-protein picks", () => {
    expect(places.filter((place) => place.category === "Gyms & fitness").length).toBeGreaterThanOrEqual(3);
    expect(places.filter((place) => matchesCategory(place, "Healthy eats")).length).toBeGreaterThanOrEqual(3);
  });

  it("spotlights the new Jail House and Turkish restaurant", () => {
    const spotlit = places.filter((place) => isSpotlight(place, now)).map((place) => place.id);
    expect(spotlit).toEqual(expect.arrayContaining(["the-jail-house-pub-bistro", "alanya-restaurant"]));
  });
});
