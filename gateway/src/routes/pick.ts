import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { callPicker } from "../picker.js";

export const pickRouter = Router();

const titleId = z.string().regex(/^(movie|tv):\d+$/);

const pickRequest = z.object({
  type: z.enum(["movie", "series", "animation", "any"]).default("any"),
  genres: z.array(z.string().max(32)).max(20).default([]),
  minRating: z.number().min(0).max(10).default(0),
  yearFrom: z.number().int().min(1870).max(2100).optional(),
  yearTo: z.number().int().min(1870).max(2100).optional(),
  maxRuntime: z.number().int().min(1).max(600).optional(),
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  region: z.string().regex(/^[A-Z]{2}$/).optional(),
  // Titles to skip this session (e.g. recent rerolls), sent by the client.
  excludeIds: z.array(titleId).max(500).default([]),
  excludeSeen: z.boolean().default(true),
  look: z.enum(["any", "colorful"]).default("any"),
  // Only titles streaming on these services (keys like "netflix") in the region.
  services: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/, "Unknown streaming service")).max(30).default([]),
});

// Streaming services in a country, for the Spin page's "Streaming on" filter.
pickRouter.get("/providers", async (req, res) => {
  const region = /^[A-Za-z]{2}$/.test(String(req.query.region)) ? String(req.query.region).toUpperCase() : "US";
  const { status, body } = await callPicker(`/providers?region=${region}`);
  res.status(status).json(body);
});

pickRouter.get("/genres", async (_req, res) => {
  const { status, body } = await callPicker("/genres");
  res.status(status).json(body);
});

// Title search (movies and series): the shortlist's quick add and the search page.
pickRouter.get("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length > 100) {
    res.status(400).json({ error: "Type a title to search for." });
    return;
  }
  const limit = /^\d{1,2}$/.test(String(req.query.limit)) ? `&limit=${req.query.limit}` : "";
  const { status, body } = await callPicker(`/search?q=${encodeURIComponent(q)}${limit}`);
  res.status(status).json(body);
});

// Well-known movies, series or people (IDs), for the web app's sitemap.
pickRouter.get("/popular", async (req, res) => {
  const media = req.query.media === "tv" || req.query.media === "person" ? req.query.media : "movie";
  const pages = /^\d{1,2}$/.test(String(req.query.pages)) ? `&pages=${req.query.pages}` : "";
  const { status, body } = await callPicker(`/popular?media=${media}${pages}`);
  res.status(status).json(body);
});

// The most popular titles matching Spin filters, for the web app's landing pages
// (e.g. popular horror movies). Same filters as /pick; no randomness, no user data.
const browseRequest = z.object({
  request: pickRequest.omit({ excludeIds: true, excludeSeen: true }),
  limit: z.number().int().min(1).max(40).default(20),
});

pickRouter.post("/browse", async (req, res) => {
  const parsed = browseRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const { status, body } = await callPicker("/browse", { method: "POST", body: JSON.stringify(parsed.data) });
  res.status(status).json(body);
});

// A single title; `/full` adds cast, crew, seasons and everything else for the title page.
const getTitle = (full: boolean) => async (req: Request<{ media: string; id: string }>, res: Response) => {
  const { media, id } = req.params;
  if (!/^(movie|tv)$/.test(media) || !/^\d+$/.test(id)) {
    res.status(400).json({ error: "Invalid title" });
    return;
  }
  const region = /^[A-Za-z]{2}$/.test(String(req.query.region)) ? String(req.query.region) : "US";
  const { status, body } = await callPicker(`/title/${media}/${id}${full ? "/full" : ""}?region=${region}`);
  res.status(status).json(body);
};
pickRouter.get("/title/:media/:id", getTitle(false));
pickRouter.get("/title/:media/:id/full", getTitle(true));

// Which episodes or seasons of a series a person's credits cover (TMDB credit IDs, up to 5).
pickRouter.get("/episodes", async (req, res) => {
  const credits = String(req.query.credits ?? "");
  if (!/^[0-9a-f]{24}(,[0-9a-f]{24}){0,4}$/.test(credits)) {
    res.status(400).json({ error: "Invalid credits" });
    return;
  }
  const { status, body } = await callPicker(`/episodes?credits=${credits}`);
  res.status(status).json(body);
});

// An actor or crew member with their filmography.
pickRouter.get("/person/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: "Invalid person" });
    return;
  }
  const { status, body } = await callPicker(`/person/${req.params.id}`);
  res.status(status).json(body);
});

pickRouter.post("/pick", async (req, res) => {
  const parsed = pickRequest.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid filters" });
    return;
  }
  const { excludeSeen, ...filters } = parsed.data;
  const user = req.user;
  const exclude = new Set(filters.excludeIds);

  if (user && pool) {
    if (excludeSeen) {
      // Skip titles already seen or currently being watched.
      const { rows } = await pool.query<{ title_id: string }>(
        "SELECT title_id FROM seen WHERE user_id = $1 UNION SELECT title_id FROM watching WHERE user_id = $1",
        [user.id],
      );
      rows.forEach((r) => exclude.add(r.title_id));
    }
    if (!filters.region) {
      const { rows } = await pool.query<{ region: string }>("SELECT region FROM users WHERE id = $1", [user.id]);
      filters.region = rows[0]?.region;
    }
  }

  const { status, body } = await callPicker("/pick", {
    method: "POST",
    body: JSON.stringify({ ...filters, excludeIds: [...exclude] }),
  });

  if (status === 200 && user && pool) {
    await pool.query("INSERT INTO history (user_id, title_id, title) VALUES ($1, $2, $3)", [user.id, body.id, body]);
    body.library = await libraryStatus(user.id, body.id);
  }
  res.status(status).json(body);
});

/**
 * Where a title is in the user's library, for tagging spin results:
 * "seen", "watching" or "watchlist" (in that order of precedence), or undefined.
 */
export async function libraryStatus(userId: string, titleId: string) {
  const { rows } = await pool!.query<{ seen: boolean; watching: boolean; watchlist: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM seen WHERE user_id = $1 AND title_id = $2) AS seen,
            EXISTS (SELECT 1 FROM watching WHERE user_id = $1 AND title_id = $2) AS watching,
            EXISTS (SELECT 1 FROM watchlist WHERE user_id = $1 AND title_id = $2) AS watchlist`,
    [userId, titleId],
  );
  const r = rows[0];
  return r?.seen ? "seen" : r?.watching ? "watching" : r?.watchlist ? "watchlist" : undefined;
}
