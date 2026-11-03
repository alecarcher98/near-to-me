import { describe, expect, it } from "vitest";
import { distanceMiles, formatDistance, formatTravel, isUkPostcode, projectToMap, walkMinutes } from "@/lib/geo";

const nuneaton = { lat: 52.5229, lng: -1.4679 };
const coventry = { lat: 52.4068, lng: -1.5197 };

describe("distanceMiles", () => {
  it("is zero for the same point", () => {
    expect(distanceMiles(nuneaton, nuneaton)).toBe(0);
  });

  it("measures Nuneaton to Coventry at roughly 8.4 miles", () => {
    expect(distanceMiles(nuneaton, coventry)).toBeCloseTo(8.4, 0);
  });

  it("is symmetric", () => {
    expect(distanceMiles(nuneaton, coventry)).toBeCloseTo(distanceMiles(coventry, nuneaton), 10);
  });
});

describe("travel labels", () => {
  it("walks at 3 mph with a one-minute floor", () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(1)).toBe(20);
  });

  it("formats short and long distances", () => {
    expect(formatDistance(0.05)).toBe("<0.1 mi");
    expect(formatDistance(1.26)).toBe("1.3 mi");
    expect(formatDistance(14.6)).toBe("15 mi");
  });

  it("suggests driving beyond two miles", () => {
    expect(formatTravel(0.5)).toBe("10 min walk");
    expect(formatTravel(3)).toBe("drive or bus");
  });
});

describe("projectToMap", () => {
  it("puts the origin in the centre", () => {
    expect(projectToMap(nuneaton, nuneaton, 3)).toEqual({ x: 50, y: 50 });
  });

  it("puts places to the north above the centre and east to the right", () => {
    const north = projectToMap(nuneaton, { lat: nuneaton.lat + 0.01, lng: nuneaton.lng }, 3);
    const east = projectToMap(nuneaton, { lat: nuneaton.lat, lng: nuneaton.lng + 0.01 }, 3);
    expect(north.y).toBeLessThan(50);
    expect(east.x).toBeGreaterThan(50);
  });

  it("puts a place exactly one radius north on the ring edge", () => {
    const point = projectToMap(nuneaton, { lat: nuneaton.lat + 1 / 69, lng: nuneaton.lng }, 1);
    expect(point.y).toBeCloseTo(4, 5);
  });
});

describe("isUkPostcode", () => {
  it.each(["CV11 4DZ", "cv114dz", "B1 1AA", "LE10 0AA"])("accepts %s", (value) => {
    expect(isUkPostcode(value)).toBe(true);
  });

  it.each(["", "CV11", "12345", "CV11 4D"])("rejects %s", (value) => {
    expect(isUkPostcode(value)).toBe(false);
  });
});
