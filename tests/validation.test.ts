import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/types";
import { parseEnquiry, parseEnquiryStatus, parseEvent, parsePlace, parseReview, parseUpdate } from "@/lib/validation";

const place = { name: "Test Gym", category: "Gyms & fitness", address: "1 High St, Nuneaton CV11 4DZ", details: "Open 24/7", lat: 52.52, lng: -1.46 };

describe("parsePlace", () => {
  it("accepts a valid place and generates an id", () => {
    const result = parsePlace(place);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toMatch(/^test-gym-/);
  });

  it("keeps an existing id when editing", () => {
    const result = parsePlace({ ...place, id: "test-gym" });
    expect(result.ok && result.value.id).toBe("test-gym");
  });

  it("rejects unknown categories, missing names and coordinates outside the UK", () => {
    expect(parsePlace({ ...place, category: "Casino" }).ok).toBe(false);
    expect(parsePlace({ ...place, name: "  " }).ok).toBe(false);
    expect(parsePlace({ ...place, lat: 40 }).ok).toBe(false);
    expect(parsePlace({ ...place, lng: "west" }).ok).toBe(false);
  });

  it("only stores spotlight and sponsorship details when switched on", () => {
    const off = parsePlace({ ...place, spotlightEndsAt: "2026-12-01", sponsoredUntil: "2026-12-01" });
    expect(off.ok && off.value).not.toHaveProperty("spotlightEndsAt");
    expect(off.ok && off.value).not.toHaveProperty("sponsored");
    const on = parsePlace({ ...place, launchSpotlight: true, spotlightEndsAt: "2026-12-01", sponsored: "on" });
    expect(on.ok && on.value).toMatchObject({ launchSpotlight: true, spotlightEndsAt: "2026-12-01", sponsored: true });
  });

  it("drops malformed tags", () => {
    const result = parsePlace({ ...place, tags: ["healthy", "<script>", 42] });
    expect(result.ok && result.value.tags).toEqual(["healthy"]);
  });

  it("rejects ids that aren't simple slugs", () => {
    const result = parsePlace({ ...place, id: "../../etc" });
    expect(result.ok && result.value.id).not.toBe("../../etc");
  });

  it("rejects non-objects", () => {
    expect(parsePlace(null).ok).toBe(false);
    expect(parsePlace([place]).ok).toBe(false);
  });
});

describe("parseEvent", () => {
  const event = { title: "Quiz", venue: "The Pub", address: "Somewhere", day: "Thursday", time: "8pm", description: "Weekly quiz" };

  it("accepts a weekly event", () => {
    expect(parseEvent(event)).toMatchObject({ ok: true, value: { day: "Thursday" } });
  });

  it("derives the weekday from a one-off date", () => {
    expect(parseEvent({ ...event, date: "2026-11-05" })).toMatchObject({ ok: true, value: { day: "Thursday", date: "2026-11-05" } });
  });

  it("rejects an unknown weekday", () => {
    expect(parseEvent({ ...event, day: "Funday" }).ok).toBe(false);
  });
});

describe("parseUpdate", () => {
  it("adds https to bare web links", () => {
    const result = parseUpdate({ title: "Market moves", body: "Saturday market is on Queens Road this week.", link: "nuneaton.gov.uk" });
    expect(result.ok && result.value.link).toBe("https://nuneaton.gov.uk/");
  });

  it("rejects unsupported kinds", () => {
    expect(parseUpdate({ kind: "advert", title: "t", body: "b" }).ok).toBe(false);
  });
});

describe("parseReview", () => {
  const places = [{ id: "cafe", name: "Café" }] as Place[];

  it("accepts a review for a known place", () => {
    expect(parseReview({ placeId: "cafe", rating: 4, text: "Lovely" }, places)).toMatchObject({ ok: true, value: { placeName: "Café", author: "Local explorer", rating: 4 } });
  });

  it("rejects unknown places, empty text and out-of-range ratings", () => {
    expect(parseReview({ placeId: "nope", rating: 4, text: "x" }, places).ok).toBe(false);
    expect(parseReview({ placeId: "cafe", rating: 4, text: " " }, places).ok).toBe(false);
    expect(parseReview({ placeId: "cafe", rating: 9, text: "x" }, places).ok).toBe(false);
  });

  it("limits review length", () => {
    expect(parseReview({ placeId: "cafe", rating: 5, text: "a".repeat(1001) }, places).ok).toBe(false);
  });
});

describe("parseEnquiry", () => {
  const enquiry = { kind: "sponsorship", businessName: "Bean There", contactName: "Sam", email: "sam@example.com", message: "We'd like to be featured." };

  it("accepts a sponsorship enquiry and marks it new", () => {
    expect(parseEnquiry(enquiry)).toMatchObject({ ok: true, value: { kind: "sponsorship", status: "new" } });
  });

  it("rejects a bad email address", () => {
    expect(parseEnquiry({ ...enquiry, email: "not-an-email" }).ok).toBe(false);
  });

  it("validates status changes", () => {
    expect(parseEnquiryStatus({ id: "a", status: "done" }).ok).toBe(true);
    expect(parseEnquiryStatus({ id: "a", status: "archived" }).ok).toBe(false);
  });
});
