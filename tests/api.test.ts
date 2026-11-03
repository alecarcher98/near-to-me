import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const origin = "http://localhost:3000";
let directory: string;
let routes: {
  content: typeof import("@/app/api/content/route");
  reviews: typeof import("@/app/api/reviews/route");
  enquiries: typeof import("@/app/api/enquiries/route");
  session: typeof import("@/app/api/admin/session/route");
  admin: typeof import("@/app/api/admin/content/route");
};

function request(url: string, init: { method?: string; body?: unknown; cookie?: string; sameSite?: boolean } = {}) {
  const headers: Record<string, string> = { host: "localhost:3000" };
  if (init.sameSite !== false && init.method && init.method !== "GET") headers.origin = origin;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(`${origin}${url}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "near-to-me-api-"));
  process.env.CONTENT_DIR = directory;
  process.env.ADMIN_USERS = "Sam:test-password-123";
  process.env.ADMIN_SESSION_SECRET = "s".repeat(48);
  routes = {
    content: await import("@/app/api/content/route"),
    reviews: await import("@/app/api/reviews/route"),
    enquiries: await import("@/app/api/enquiries/route"),
    session: await import("@/app/api/admin/session/route"),
    admin: await import("@/app/api/admin/content/route"),
  };
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function signIn() {
  const response = await routes.session.POST(request("/api/admin/session", { method: "POST", body: { name: "sam", password: "test-password-123" } }));
  expect(response.status).toBe(200);
  const token = response.cookies.get("ntm_admin")?.value;
  expect(token).toBeTruthy();
  return `ntm_admin=${token}`;
}

describe("public API", () => {
  it("serves places and events without business enquiries", async () => {
    const response = await routes.content.GET(request("/api/content?area=nuneaton"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.places.length).toBeGreaterThan(100);
    expect(body).not.toHaveProperty("enquiries");
  });

  it("404s an unknown area", async () => {
    expect((await routes.content.GET(request("/api/content?area=atlantis"))).status).toBe(404);
  });

  it("accepts a review from this site", async () => {
    const response = await routes.reviews.POST(request("/api/reviews", { method: "POST", body: { area: "nuneaton", placeId: "riversley-park", rating: 5, text: "Lovely walk." } }));
    expect(response.status).toBe(201);
    const content = await (await routes.content.GET(request("/api/content"))).json();
    expect(content.reviews[0]).toMatchObject({ placeId: "riversley-park", text: "Lovely walk." });
  });

  it("blocks cross-site posts", async () => {
    const response = await routes.reviews.POST(request("/api/reviews", { method: "POST", sameSite: false, body: { placeId: "riversley-park", rating: 5, text: "x" } }));
    expect(response.status).toBe(403);
  });

  it("rejects invalid enquiries and silently drops bot submissions", async () => {
    expect((await routes.enquiries.POST(request("/api/enquiries", { method: "POST", body: { businessName: "B" } }))).status).toBe(400);
    expect((await routes.enquiries.POST(request("/api/enquiries", { method: "POST", body: { contactTime: "bot" } }))).status).toBe(201);
  });
});

describe("admin API", () => {
  it("refuses changes without signing in", async () => {
    expect((await routes.admin.GET(request("/api/admin/content"))).status).toBe(401);
    expect((await routes.admin.PUT(request("/api/admin/content", { method: "PUT", body: { collection: "places", item: {} } }))).status).toBe(401);
  });

  it("rejects a wrong password", async () => {
    const response = await routes.session.POST(request("/api/admin/session", { method: "POST", body: { name: "Sam", password: "nope" } }));
    expect(response.status).toBe(401);
  });

  it("lets an admin add, edit and remove a place that the public site then shows", async () => {
    const cookie = await signIn();
    const item = { name: "Admin Added Gym", category: "Gyms & fitness", address: "1 Test St, Nuneaton CV11 4DZ", lat: 52.52, lng: -1.46, details: "Test", launchSpotlight: true, spotlightEndsAt: "2099-01-01" };
    const created = await routes.admin.PUT(request("/api/admin/content", { method: "PUT", cookie, body: { collection: "places", item } }));
    expect(created.status).toBe(200);
    const { item: saved } = await created.json();

    let content = await (await routes.content.GET(request("/api/content"))).json();
    expect(content.places.find((place: { id: string }) => place.id === saved.id)).toMatchObject({ name: "Admin Added Gym", launchSpotlight: true });

    await routes.admin.PUT(request("/api/admin/content", { method: "PUT", cookie, body: { collection: "places", item: { ...item, id: saved.id, name: "Renamed Gym" } } }));
    content = await (await routes.content.GET(request("/api/content"))).json();
    expect(content.places.filter((place: { id: string }) => place.id === saved.id).map((place: { name: string }) => place.name)).toEqual(["Renamed Gym"]);

    const removed = await routes.admin.DELETE(request(`/api/admin/content?collection=places&id=${saved.id}`, { method: "DELETE", cookie }));
    expect(removed.status).toBe(200);
    content = await (await routes.content.GET(request("/api/content"))).json();
    expect(content.places.some((place: { id: string }) => place.id === saved.id)).toBe(false);
  });

  it("lets an admin post a noticeboard update and hides it once expired", async () => {
    const cookie = await signIn();
    await routes.admin.PUT(request("/api/admin/content", { method: "PUT", cookie, body: { collection: "updates", item: { title: "Live", body: "Showing" } } }));
    await routes.admin.PUT(request("/api/admin/content", { method: "PUT", cookie, body: { collection: "updates", item: { title: "Old", body: "Gone", expiresAt: "2020-01-01" } } }));
    const content = await (await routes.content.GET(request("/api/content"))).json();
    expect(content.updates.map((update: { title: string }) => update.title)).toEqual(["Live"]);
  });

  it("shows business enquiries to admins and lets them change status", async () => {
    const cookie = await signIn();
    await routes.enquiries.POST(request("/api/enquiries", { method: "POST", body: { kind: "sponsorship", businessName: "Bean There", contactName: "Jo", email: "jo@example.com", message: "Feature us" } }));
    const { enquiries } = await (await routes.admin.GET(request("/api/admin/content", { cookie }))).json();
    expect(enquiries[0]).toMatchObject({ businessName: "Bean There", status: "new" });
    const patched = await routes.admin.PATCH(request("/api/admin/content", { method: "PATCH", cookie, body: { id: enquiries[0].id, status: "done" } }));
    expect(patched.status).toBe(200);
  });

  it("blocks admin changes sent from another site even with a valid session", async () => {
    const cookie = await signIn();
    const response = await routes.admin.DELETE(request("/api/admin/content?collection=places&id=riversley-park", { method: "DELETE", cookie, sameSite: false }));
    expect(response.status).toBe(403);
  });
});
