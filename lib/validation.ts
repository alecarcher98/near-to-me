import { weekdays } from "@/lib/events";
import { placeCategories } from "@/lib/places";
import type { Enquiry, EnquiryKind, LocalEvent, Place, Review, Update, UpdateKind } from "@/lib/types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

class InvalidInput extends Error {}

function fields(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InvalidInput("Expected an object.");
  const record = input as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => {
    const raw = record[key];
    if (raw !== undefined && raw !== null && typeof raw !== "string") throw new InvalidInput(`${key} must be text.`);
    const value = (raw ?? "").trim();
    if (required && !value) throw new InvalidInput(`${key} is required.`);
    if (value.length > max) throw new InvalidInput(`${key} must be ${max} characters or fewer.`);
    return value;
  };
  const optionalText = (key: string, max: number) => text(key, max) || undefined;
  const number = (key: string, min: number, max: number) => {
    const value = Number(record[key]);
    if (!Number.isFinite(value) || value < min || value > max) throw new InvalidInput(`${key} must be a number between ${min} and ${max}.`);
    return value;
  };
  const flag = (key: string) => record[key] === true || record[key] === "on" || record[key] === "true";
  const date = (key: string) => {
    const value = text(key, 40);
    if (value && Number.isNaN(Date.parse(value))) throw new InvalidInput(`${key} must be a date.`);
    return value || undefined;
  };
  const oneOf = <T extends string>(key: string, options: readonly T[], fallback?: T) => {
    const value = text(key, 60) || fallback;
    if (!value || !options.includes(value as T)) throw new InvalidInput(`${key} must be one of: ${options.join(", ")}.`);
    return value as T;
  };
  const link = (key: string) => {
    const value = text(key, 300);
    if (!value) return undefined;
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      return new URL(url).toString();
    } catch {
      throw new InvalidInput(`${key} must be a web address.`);
    }
  };
  return { record, text, optionalText, number, flag, date, oneOf, link };
}

function parse<T>(build: () => T): Parsed<T> {
  try {
    return { ok: true, value: build() };
  } catch (error) {
    if (error instanceof InvalidInput) return { ok: false, error: error.message };
    throw error;
  }
}

export function makeId(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
  return `${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function idFor(record: Record<string, unknown>, name: string) {
  return typeof record.id === "string" && /^[a-z0-9-]{1,80}$/.test(record.id) ? record.id : makeId(name);
}

export function parsePlace(input: unknown): Parsed<Place> {
  return parse(() => {
    const f = fields(input);
    const name = f.text("name", 120, true);
    const tags = Array.isArray(f.record.tags) ? f.record.tags.filter((tag): tag is string => typeof tag === "string" && /^[a-z-]{1,30}$/.test(tag)).slice(0, 10) : [];
    const launchSpotlight = f.flag("launchSpotlight");
    const sponsored = f.flag("sponsored");
    return {
      id: idFor(f.record, name),
      name,
      category: f.oneOf("category", placeCategories),
      details: f.text("details", 1000),
      address: f.text("address", 200, true),
      lat: f.number("lat", 49, 61),
      lng: f.number("lng", -9, 2.5),
      ...(f.flag("approximateLocation") ? { approximateLocation: true } : {}),
      ...(tags.length ? { tags } : {}),
      ...(f.flag("recommended") ? { recommended: true } : {}),
      ...(sponsored ? { sponsored, sponsoredUntil: f.date("sponsoredUntil") } : {}),
      ...(launchSpotlight ? { launchSpotlight, spotlightEndsAt: f.date("spotlightEndsAt"), spotlightNote: f.optionalText("spotlightNote", 200) } : {}),
    };
  });
}

export function parseEvent(input: unknown): Parsed<LocalEvent> {
  return parse(() => {
    const f = fields(input);
    const title = f.text("title", 120, true);
    const date = f.date("date");
    return {
      id: idFor(f.record, title),
      title,
      venue: f.text("venue", 120, true),
      address: f.text("address", 200, true),
      day: date ? weekdays[new Date(`${date}T00:00:00`).getDay()] : f.oneOf("day", weekdays),
      ...(date ? { date } : {}),
      time: f.text("time", 30, true),
      category: f.text("category", 40) || "Good company",
      description: f.text("description", 200, true),
      detail: f.text("detail", 1500),
      host: f.text("host", 80) || "Near to me",
      posted: f.date("posted") ?? new Date().toISOString().slice(0, 10),
    };
  });
}

const updateKinds: readonly UpdateKind[] = ["update", "recommendation", "offer"];

export function parseUpdate(input: unknown): Parsed<Update> {
  return parse(() => {
    const f = fields(input);
    const title = f.text("title", 120, true);
    return {
      id: idFor(f.record, title),
      kind: f.oneOf("kind", updateKinds, "update"),
      title,
      body: f.text("body", 1000, true),
      link: f.link("link"),
      placeId: f.optionalText("placeId", 80),
      ...(f.flag("pinned") ? { pinned: true } : {}),
      postedAt: f.date("postedAt") ?? new Date().toISOString(),
      expiresAt: f.date("expiresAt"),
    };
  });
}

export function parseReview(input: unknown, places: Place[]): Parsed<Review> {
  return parse(() => {
    const f = fields(input);
    const place = places.find((item) => item.id === f.text("placeId", 80, true));
    if (!place) throw new InvalidInput("That place isn't in this guide.");
    return {
      id: makeId(place.name),
      placeId: place.id,
      placeName: place.name,
      author: f.text("author", 60) || "Local explorer",
      rating: Math.round(f.number("rating", 1, 5)),
      text: f.text("text", 1000, true),
      createdAt: new Date().toISOString(),
    };
  });
}

const enquiryKinds: readonly EnquiryKind[] = ["sponsorship", "listing", "reviews", "other"];

export function parseEnquiry(input: unknown): Parsed<Enquiry> {
  return parse(() => {
    const f = fields(input);
    const email = f.text("email", 160, true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvalidInput("Enter a valid email address.");
    const businessName = f.text("businessName", 120, true);
    return {
      id: makeId(businessName),
      kind: f.oneOf("kind", enquiryKinds, "other"),
      status: "new",
      businessName,
      contactName: f.text("contactName", 80, true),
      email,
      phone: f.optionalText("phone", 40),
      businessType: f.optionalText("businessType", 60),
      address: f.optionalText("address", 200),
      openingDate: f.date("openingDate"),
      website: f.optionalText("website", 300),
      message: f.text("message", 2000, true),
      createdAt: new Date().toISOString(),
    };
  });
}

export function parseEnquiryStatus(input: unknown): Parsed<Pick<Enquiry, "id" | "status">> {
  return parse(() => {
    const f = fields(input);
    return { id: f.text("id", 120, true), status: f.oneOf("status", ["new", "in-progress", "done"] as const) };
  });
}
