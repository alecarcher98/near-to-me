import { NextResponse, type NextRequest } from "next/server";
import { adminConfig } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-request";
import { areas } from "@/lib/areas";
import { contentStore, storage } from "@/lib/content-store";
import { placeLabel } from "@/lib/geocode";
import { route } from "@/lib/http";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

type Level = "ok" | "warning" | "down";
type Check = { name: string; level: Level; detail: string; ms?: number };

async function timed(name: string, run: () => Promise<string>, failLevel: Level = "down"): Promise<Check> {
  const started = Date.now();
  try {
    const detail = await run();
    return { name, level: "ok", detail, ms: Date.now() - started };
  } catch (error) {
    return { name, level: failLevel, detail: error instanceof Error ? error.message : "Failed.", ms: Date.now() - started };
  }
}

const day = 86_400_000;

// Everything the main admins need to know is working, plus sign-up numbers. Main admins only.
export const GET = route(async (request: NextRequest) => {
  const access = requireAdmin(request, false, { owner: true });
  if ("error" in access) return access.error;

  const storageNames = { redis: "Upstash Redis", files: "JSON files on this server", "read-only": "None (read-only)" };
  const checks = await Promise.all([
    timed("Database", async () => {
      if (storage.kind === "read-only") throw new Error("No database is connected, so nothing can be saved. Add Upstash Redis.");
      if (storage.redis) {
        const pong = await storage.redis.command<string>(["PING"]);
        if (pong !== "PONG") throw new Error(`Unexpected reply from Redis: ${pong}`);
      }
      // A real write round trip (changes nothing).
      await contentStore.updateMembers(() => undefined);
      return `${storageNames[storage.kind]} · reading and saving work`;
    }),
    timed("Postcode lookups (postcodes.io)", async () => {
      const response = await fetch("https://api.postcodes.io/postcodes/CV114DZ", { signal: AbortSignal.timeout(4000), cache: "no-store" });
      if (!response.ok) throw new Error(`postcodes.io replied ${response.status}. Location checks and sign-ups from new places will fail until it's back.`);
      return "Working";
    }),
  ]);

  const config = adminConfig();
  const siteUrl = process.env.SITE_URL;
  checks.push(
    { name: "Admin sign-in", level: config.problems.length ? "down" : config.warnings.length ? "warning" : "ok", detail: [...config.problems, ...config.warnings].join(". ") || `${config.users.size} admin${config.users.size === 1 ? "" : "s"}, ${config.owners.size || config.users.size} main` },
    { name: "Site address (SITE_URL)", level: siteUrl ? "ok" : "warning", detail: siteUrl ? `${siteUrl} · forms only work when people use this exact address` : "Not set: the sitemap is empty and form checks rely on the request's host" },
    { name: "Operator details", level: process.env.NEXT_PUBLIC_OPERATOR_NAME && site.contactEmail ? "ok" : "warning", detail: process.env.NEXT_PUBLIC_OPERATOR_NAME && site.contactEmail ? `${site.operator} · ${site.contactEmail}` : "Set NEXT_PUBLIC_OPERATOR_NAME and NEXT_PUBLIC_CONTACT_EMAIL for the privacy and terms pages" },
  );

  const now = Date.now();
  const [members, waitlist, areaContent] = await Promise.all([
    contentStore.readMembers().catch(() => []),
    contentStore.readWaitlist().catch(() => []),
    Promise.all(Object.values(areas).map(async (area) => ({ area, content: await contentStore.read(area.id).catch(() => null) }))),
  ]);
  const since = (iso: string, days: number) => now - Date.parse(iso) < days * day;

  const demand = Object.entries(waitlist.reduce<Record<string, { people: number; notEmailed: number; businesses: number }>>((groups, entry) => {
    const label = entry.place ? placeLabel(entry.place) : entry.location;
    const group = (groups[label] ??= { people: 0, notEmailed: 0, businesses: 0 });
    group.people += 1;
    if (!entry.notifiedAt) group.notEmailed += 1;
    if (entry.role === "business") group.businesses += 1;
    return groups;
  }, {})).map(([location, counts]) => ({ location, ...counts })).sort((a, b) => b.people - a.people);

  const signupsByDay = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now - (13 - index) * day).toISOString().slice(0, 10);
    return { date, count: members.filter((member) => member.createdAt.slice(0, 10) === date).length };
  });

  const levels = checks.map((check) => check.level);
  return NextResponse.json({
    status: levels.includes("down") ? "down" : levels.includes("warning") ? "warning" : "ok",
    checkedAt: new Date(now).toISOString(),
    deployment: {
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
    checks,
    signups: {
      total: members.length,
      live: members.filter((member) => member.status === "live").length,
      waitlist: members.filter((member) => member.status === "waitlist").length,
      today: members.filter((member) => since(member.createdAt, 1)).length,
      week: members.filter((member) => since(member.createdAt, 7)).length,
      byDay: signupsByDay,
    },
    comingSoon: { people: waitlist.length, notEmailed: waitlist.filter((entry) => !entry.notifiedAt).length, locations: demand.length, top: demand.slice(0, 10) },
    areas: areaContent.map(({ area, content }) => ({
      id: area.id,
      name: area.name,
      members: members.filter((member) => member.areaId === area.id).length,
      places: content?.places.length ?? null,
      events: content?.events.length ?? null,
      reviews: content?.reviews.length ?? null,
      reviewsThisWeek: content?.reviews.filter((review) => since(review.createdAt, 7)).length ?? null,
      newEnquiries: content?.enquiries.filter((enquiry) => enquiry.status === "new").length ?? null,
    })),
  }, { headers: { "cache-control": "no-store" } });
});
