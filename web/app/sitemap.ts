import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { toSlug } from "@/lib/api";
import { getPopular } from "@/lib/server-api";
import { SITE_URL } from "@/lib/site";

// TMDB pages of 20 titles each: about 500 movies and 500 series.
const POPULAR_PAGES = 25;

/**
 * The public pages, plus the title pages people are most likely to search for
 * (TMDB's most popular, refreshed daily). Personal pages (library, profile,
 * login...) are left out and marked noindex.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Built when requested, not at build time: the popular list comes from the API.
  await connection();
  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/help`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/credits`, changeFrequency: "yearly", priority: 0.2 },
  ];
  // If the API is down, the static pages are still worth listing.
  const [movies, series] = await Promise.all([
    getPopular("movie", POPULAR_PAGES).catch(() => []),
    getPopular("tv", POPULAR_PAGES).catch(() => []),
  ]);
  for (const id of [...movies, ...series]) {
    pages.push({ url: `${SITE_URL}/t/${toSlug(id)}`, changeFrequency: "weekly", priority: 0.7 });
  }
  return pages;
}
