import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL;
  if (!base) return [];
  return ["/", "/account", "/privacy", "/terms"].map((path) => ({ url: new URL(path, base).toString(), changeFrequency: path === "/" ? "daily" : "monthly" }));
}
