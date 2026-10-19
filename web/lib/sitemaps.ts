import { toSlug } from "./api";
import { LANDING_PAGES, landingPath } from "./landing";
import { getPopular } from "./server-api";
import { SITE_URL } from "./site";

// Cynatra's sitemaps, split by kind so Search Console reports indexing for each:
// /sitemap.xml is the index (the address Google already has), pointing to these.
// TMDB pages hold 20 entries: about 500 movies, 500 series and 500 people.
const POPULAR_PAGES = 25;

type Entry = { url: string; changefreq: "daily" | "weekly" | "monthly" | "yearly"; priority: number };

export const SITEMAPS: Record<string, () => Promise<Entry[]>> = {
  "pages.xml": async () => [
    { url: SITE_URL, changefreq: "daily", priority: 1 },
    { url: `${SITE_URL}/help`, changefreq: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/install`, changefreq: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changefreq: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changefreq: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/credits`, changefreq: "yearly", priority: 0.2 },
  ],
  "discover.xml": async () => [
    { url: `${SITE_URL}/discover`, changefreq: "weekly", priority: 0.8 },
    ...LANDING_PAGES.map((l) => ({ url: `${SITE_URL}${landingPath(l)}`, changefreq: "daily" as const, priority: 0.8 })),
  ],
  "titles.xml": async () => {
    // A partial list beats none if the API is struggling.
    const [movies, series] = await Promise.all([
      getPopular("movie", POPULAR_PAGES).catch(() => []),
      getPopular("tv", POPULAR_PAGES).catch(() => []),
    ]);
    return [...movies, ...series].map((id) => ({
      url: `${SITE_URL}/t/${toSlug(id)}`,
      changefreq: "weekly",
      priority: 0.7,
    }));
  },
  "people.xml": async () =>
    (await getPopular("person", POPULAR_PAGES).catch(() => [])).map((id) => ({
      url: `${SITE_URL}/p/${id}`,
      changefreq: "weekly",
      priority: 0.5,
    })),
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function xmlResponse(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Crawlers and browsers may keep it an hour; the data behind it changes daily.
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export function urlset(entries: Entry[]) {
  const urls = entries
    .map(
      (e) =>
        `<url><loc>${escape(e.url)}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
    )
    .join("\n");
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function sitemapIndex() {
  const items = Object.keys(SITEMAPS)
    .map((name) => `<sitemap><loc>${SITE_URL}/sitemaps/${name}</loc></sitemap>`)
    .join("\n");
  return `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}
