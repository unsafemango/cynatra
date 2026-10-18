import { cacheLife } from "next/cache";
import { API_URL, fromSlug, type FullTitle, type Person } from "./api";

// Server-side reads for pages search engines should see fully rendered (title
// and person pages, the sitemap). Inside the cluster or Docker Compose the web
// server talks to the gateway directly (SERVER_API_URL, e.g. http://gateway:4000);
// otherwise it uses the same address as the browser.
const SERVER_API_URL = (process.env.SERVER_API_URL || API_URL).replace(/\/$/, "");

/** GET from the gateway. null for a 404; throws for anything else, so a hiccup isn't cached. */
async function getJSON<T>(path: string): Promise<T | null> {
  "use cache";
  cacheLife("hours");
  const res = await fetch(SERVER_API_URL + path, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return (await res.json()) as T;
}

/** A title page's data from its URL slug (e.g. "movie-550"). US streaming info, like logged-out visitors get. */
export async function getTitle(slug: string): Promise<FullTitle | null> {
  const m = /^(movie|tv):(\d+)$/.exec(fromSlug(slug));
  if (!m) return null;
  return getJSON<FullTitle>(`/api/title/${m[1]}/${m[2]}/full?region=US`);
}

export async function getPerson(id: string): Promise<Person | null> {
  if (!/^\d+$/.test(id)) return null;
  return getJSON<Person>(`/api/person/${id}`);
}

/** Well-known titles ("movie:550") or people ("287") for the sitemaps. */
export async function getPopular(media: "movie" | "tv" | "person", pages: number): Promise<string[]> {
  "use cache";
  cacheLife("days");
  return (await getJSON<string[]>(`/api/popular?media=${media}&pages=${pages}`)) ?? [];
}
