import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { activeAreaFor } from "@/lib/areas";
import { placeLabel, resolveLocation } from "@/lib/geocode";

// Stand-in for postcodes.io so tests don't touch the network.
const postcodes: Record<string, object> = {
  "CV11 4DZ": { postcode: "CV11 4DZ", latitude: 52.523, longitude: -1.4665, admin_district: "Nuneaton and Bedworth", admin_county: "Warwickshire" },
  "LE10 0AA": { postcode: "LE10 0AA", latitude: 52.5384, longitude: -1.3738, admin_district: "Hinckley and Bosworth", admin_county: "Leicestershire" },
};
const towns: Record<string, object> = {
  hinckley: { name_1: "Hinckley", latitude: 52.541, longitude: -1.3738, district_borough: "Hinckley and Bosworth", county_unitary: "Leicestershire", region: "East Midlands" },
  bedworth: { name_1: "Bedworth", latitude: 52.4797, longitude: -1.4704, district_borough: "Nuneaton and Bedworth", county_unitary: "Warwickshire" },
  leicester: { name_1: "Leicester", latitude: 52.6369, longitude: -1.1398, district_borough: null, county_unitary: "Leicester", region: "East Midlands" },
};

function fakePostcodesIo(input: string | URL | Request) {
  const url = new URL(String(input));
  const json = (result: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify({ status, result }), { status }));
  if (url.pathname === "/places") return json([towns[url.searchParams.get("q")!.toLowerCase()]].filter(Boolean));
  if (url.pathname === "/postcodes" && url.searchParams.has("lat")) {
    return json(Number(url.searchParams.get("lat")) > 52.53 ? [postcodes["LE10 0AA"]] : [postcodes["CV11 4DZ"]]);
  }
  const postcode = decodeURIComponent(url.pathname.replace("/postcodes/", ""));
  return postcodes[postcode] ? json(postcodes[postcode]) : json(null, 404);
}

const origin = "http://localhost:3000";
let directory: string;
let routes: {
  waitlist: typeof import("@/app/api/waitlist/route");
  coverage: typeof import("@/app/api/coverage/route");
  enquiries: typeof import("@/app/api/enquiries/route");
  session: typeof import("@/app/api/admin/session/route");
  admin: typeof import("@/app/api/admin/waitlist/route");
  join: typeof import("@/app/api/join/route");
  members: typeof import("@/app/api/admin/members/route");
  health: typeof import("@/app/api/admin/health/route");
};

function request(url: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = { host: "localhost:3000" };
  if (init.method && init.method !== "GET") headers.origin = origin;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(`${origin}${url}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

beforeAll(async () => {
  vi.stubGlobal("fetch", vi.fn(fakePostcodesIo));
  directory = await mkdtemp(path.join(tmpdir(), "near-to-me-waitlist-"));
  process.env.CONTENT_DIR = directory;
  process.env.ADMIN_USERS = "Sam:test-password-123";
  process.env.ADMIN_SESSION_SECRET = "s".repeat(48);
  routes = {
    waitlist: await import("@/app/api/waitlist/route"),
    coverage: await import("@/app/api/coverage/route"),
    enquiries: await import("@/app/api/enquiries/route"),
    session: await import("@/app/api/admin/session/route"),
    admin: await import("@/app/api/admin/waitlist/route"),
    join: await import("@/app/api/join/route"),
    members: await import("@/app/api/admin/members/route"),
    health: await import("@/app/api/admin/health/route"),
  };
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

describe("resolveLocation", () => {
  it("looks up postcodes, wherever they appear in the text", async () => {
    expect(await resolveLocation({ location: "12 Bridge St, Nuneaton cv114dz" })).toMatchObject({ name: "Nuneaton and Bedworth", district: "Nuneaton and Bedworth", postcode: "CV11 4DZ" });
  });

  it("finds a town, skipping parts with house numbers", async () => {
    expect(await resolveLocation({ location: "1 High Street, Hinckley, Leicestershire" })).toMatchObject({ name: "Hinckley", district: "Hinckley and Bosworth" });
  });

  it("uses the council for unitary authorities without a district", async () => {
    expect(await resolveLocation({ location: "Leicester" })).toMatchObject({ district: "Leicester" });
  });

  it("names a shared position from the nearest postcode and stores that, not the exact point", async () => {
    expect(await resolveLocation({ lat: 52.5412345, lng: -1.3712345 })).toMatchObject({ name: "Hinckley and Bosworth", lat: 52.5384, lng: -1.3738 });
  });

  it("falls back to the town when the postcode isn't recognised", async () => {
    expect(await resolveLocation({ location: "Hinckley ZZ1 1ZZ" })).toMatchObject({ name: "Hinckley" });
  });

  it("returns null for places it can't find", async () => {
    expect(await resolveLocation({ location: "Atlantis" })).toBeNull();
    expect(await resolveLocation({ location: "ZZ1 1ZZ" })).toBeNull();
  });

  it("labels places without repeating names", () => {
    expect(placeLabel({ name: "Leicester", county: "Leicester", lat: 0, lng: 0 })).toBe("Leicester");
    expect(placeLabel({ name: "Hinckley", county: "Leicestershire", lat: 0, lng: 0 })).toBe("Hinckley, Leicestershire");
  });
});

describe("activeAreaFor", () => {
  it("covers every town in the Nuneaton and Bedworth district", () => {
    expect(activeAreaFor({ lat: 52.4797, lng: -1.4704, district: "Nuneaton and Bedworth" })?.id).toBe("nuneaton");
  });

  it("does not cover Hinckley even though it's only four miles away", () => {
    expect(activeAreaFor({ lat: 52.541, lng: -1.3738, district: "Hinckley and Bosworth" })).toBeUndefined();
  });

  it("falls back to distance when there's no district", () => {
    expect(activeAreaFor({ lat: 52.523, lng: -1.468 })?.id).toBe("nuneaton");
    expect(activeAreaFor({ lat: 51.5, lng: -0.12 })).toBeUndefined();
  });
});

describe("coming-soon sign-ups", () => {
  it("tells people in a live area they're covered and doesn't add them to the list", async () => {
    const response = await routes.waitlist.POST(request("/api/waitlist", { method: "POST", body: { email: "a@example.com", location: "Bedworth", source: "signup" } }));
    expect(await response.json()).toMatchObject({ status: "active", areaName: "Nuneaton" });
  });

  it("adds people elsewhere to the list once per location", async () => {
    const body = { email: "Jo@Example.com", name: "Jo", location: "Hinckley", source: "signup", role: "explorer" };
    const first = await routes.waitlist.POST(request("/api/waitlist", { method: "POST", body }));
    expect(await first.json()).toEqual({ status: "coming-soon", placeName: "Hinckley, Leicestershire" });
    await routes.waitlist.POST(request("/api/waitlist", { method: "POST", body }));
    const cookie = await signIn();
    const { entries } = await (await routes.admin.GET(request("/api/admin/waitlist", { cookie }))).json();
    expect(entries.filter((entry: { email: string }) => entry.email === "jo@example.com")).toHaveLength(1);
    expect(entries[0]).toMatchObject({ email: "jo@example.com", name: "Jo", source: "signup", place: { name: "Hinckley" } });
  });

  it("keeps locations it can't place so admins can read them", async () => {
    const response = await routes.waitlist.POST(request("/api/waitlist", { method: "POST", body: { email: "b@example.com", location: "Atlantis", source: "signup" } }));
    expect(await response.json()).toEqual({ status: "unknown", placeName: "Atlantis" });
  });

  it("requires an email and a location", async () => {
    expect((await routes.waitlist.POST(request("/api/waitlist", { method: "POST", body: { location: "Hinckley" } }))).status).toBe(400);
    expect((await routes.waitlist.POST(request("/api/waitlist", { method: "POST", body: { email: "c@example.com" } }))).status).toBe(400);
  });

  it("flags business enquiries from outside live areas and adds them to the list", async () => {
    const response = await routes.enquiries.POST(request("/api/enquiries", { method: "POST", body: { kind: "listing", businessName: "Hinckley Bakes", contactName: "Lee", email: "lee@example.com", address: "4 Castle St, Hinckley LE10 0AA", message: "List us", fromSignup: true } }));
    expect(await response.json()).toEqual({ ok: true, comingSoon: "Hinckley and Bosworth, Leicestershire" });
    const { entries } = await (await routes.admin.GET(request("/api/admin/waitlist", { cookie: await signIn() }))).json();
    expect(entries[0]).toMatchObject({ email: "lee@example.com", source: "business-signup", role: "business" });
  });

  it("doesn't waitlist a business whose address can't be placed", async () => {
    const response = await routes.enquiries.POST(request("/api/enquiries", { method: "POST", body: { kind: "listing", businessName: "Mystery Shop", contactName: "Max", email: "max@example.com", address: "Unit 9", message: "List us" } }));
    expect(await response.json()).toEqual({ ok: true });
  });

  it("checks coverage for a shared position", async () => {
    const outside = await routes.coverage.GET(request("/api/coverage?lat=52.54&lng=-1.37"));
    expect(await outside.json()).toMatchObject({ status: "coming-soon" });
    const inside = await routes.coverage.GET(request("/api/coverage?location=CV11%204DZ"));
    expect(await inside.json()).toMatchObject({ status: "active" });
  });
});

describe("welcome screen sign-ups", () => {
  it("lets people in a live area straight in and records them as members", async () => {
    const response = await routes.join.POST(request("/api/join", { method: "POST", body: { email: "Live@Example.com", name: "Liv", location: "CV11 4DZ" } }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ status: "active", areaId: "nuneaton", point: { lat: 52.523, lng: -1.4665 } });
    const { members } = await (await routes.members.GET(request("/api/admin/members", { cookie: await signIn() }))).json();
    expect(members[0]).toMatchObject({ email: "live@example.com", name: "Liv", status: "live", areaId: "nuneaton" });
  });

  it("puts people elsewhere on the waitlist and says how many have asked", async () => {
    await routes.join.POST(request("/api/join", { method: "POST", body: { email: "w1@example.com", location: "Hinckley" } }));
    const response = await routes.join.POST(request("/api/join", { method: "POST", body: { email: "w2@example.com", location: "Hinckley" } }));
    expect(await response.json()).toMatchObject({ status: "coming-soon", placeName: "Hinckley, Leicestershire" });
    const cookie = await signIn();
    const { entries } = await (await routes.admin.GET(request("/api/admin/waitlist", { cookie }))).json();
    expect(entries[0]).toMatchObject({ email: "w2@example.com", source: "welcome" });
    const { members } = await (await routes.members.GET(request("/api/admin/members", { cookie }))).json();
    expect(members.find((member: { email: string }) => member.email === "w2@example.com")).toMatchObject({ status: "waitlist" });
  });

  it("asks again when the place can't be found, without saving it", async () => {
    const response = await routes.join.POST(request("/api/join", { method: "POST", body: { email: "x@example.com", location: "Atlantis" } }));
    expect(response.status).toBe(422);
    const { members } = await (await routes.members.GET(request("/api/admin/members", { cookie: await signIn() }))).json();
    expect(members.some((member: { email: string }) => member.email === "x@example.com")).toBe(false);
  });

  it("removes a member and their coming-soon entries together", async () => {
    const cookie = await signIn();
    const { members } = await (await routes.members.GET(request("/api/admin/members", { cookie }))).json();
    const target = members.find((member: { email: string }) => member.email === "w1@example.com");
    expect((await routes.members.DELETE(request(`/api/admin/members?id=${target.id}`, { method: "DELETE", cookie }))).status).toBe(200);
    const { entries } = await (await routes.admin.GET(request("/api/admin/waitlist", { cookie }))).json();
    expect(entries.some((entry: { email: string }) => entry.email === "w1@example.com")).toBe(false);
  });

  it("reports health and sign-up numbers to the main admins", async () => {
    const response = await routes.health.GET(request("/api/admin/health", { cookie: await signIn() }));
    const health = await response.json();
    expect(health.checks.find((check: { name: string }) => check.name === "Database")).toMatchObject({ level: "ok" });
    expect(health.signups.total).toBeGreaterThan(0);
    expect(health.comingSoon.top[0]).toMatchObject({ location: "Hinckley, Leicestershire" });
  });

  it("keeps sign-ups and health from admins who aren't owners", async () => {
    process.env.ADMIN_USERS = "Sam:test-password-123,Pat:test-password-456";
    process.env.ADMIN_OWNERS = "Sam";
    try {
      const login = await routes.session.POST(request("/api/admin/session", { method: "POST", body: { name: "Pat", password: "test-password-456" } }));
      const cookie = `ntm_admin=${login.cookies.get("ntm_admin")?.value}`;
      expect((await routes.members.GET(request("/api/admin/members", { cookie }))).status).toBe(403);
      expect((await routes.health.GET(request("/api/admin/health", { cookie }))).status).toBe(403);
      expect((await routes.admin.GET(request("/api/admin/waitlist", { cookie }))).status).toBe(403);
    } finally {
      process.env.ADMIN_USERS = "Sam:test-password-123";
      delete process.env.ADMIN_OWNERS;
    }
  });
});

// Sign in once and reuse the cookie, so the tests stay under the sign-in rate limit.
let adminCookie: string | undefined;
async function signIn() {
  if (adminCookie) return adminCookie;
  const response = await routes.session.POST(request("/api/admin/session", { method: "POST", body: { name: "Sam", password: "test-password-123" } }));
  adminCookie = `ntm_admin=${response.cookies.get("ntm_admin")?.value}`;
  return adminCookie;
}

describe("admin coming-soon list", () => {
  it("is only visible to admins", async () => {
    expect((await routes.admin.GET(request("/api/admin/waitlist"))).status).toBe(401);
  });

  it("lets admins mark people as emailed, undo it and remove them", async () => {
    const cookie = await signIn();
    const { entries } = await (await routes.admin.GET(request("/api/admin/waitlist", { cookie }))).json();
    const id = entries[0].id;

    await routes.admin.PATCH(request("/api/admin/waitlist", { method: "PATCH", cookie, body: { ids: [id] } }));
    let current = (await (await routes.admin.GET(request("/api/admin/waitlist", { cookie }))).json()).entries;
    expect(current.find((entry: { id: string }) => entry.id === id).notifiedAt).toBeTruthy();

    await routes.admin.PATCH(request("/api/admin/waitlist", { method: "PATCH", cookie, body: { ids: [id], notified: false } }));
    current = (await (await routes.admin.GET(request("/api/admin/waitlist", { cookie }))).json()).entries;
    expect(current.find((entry: { id: string }) => entry.id === id).notifiedAt).toBeUndefined();

    expect((await routes.admin.DELETE(request(`/api/admin/waitlist?id=${id}`, { method: "DELETE", cookie }))).status).toBe(200);
    current = (await (await routes.admin.GET(request("/api/admin/waitlist", { cookie }))).json()).entries;
    expect(current.some((entry: { id: string }) => entry.id === id)).toBe(false);
  });
});
