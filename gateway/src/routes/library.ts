import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireDb } from "../auth.js";
import { pool } from "../db/index.js";
import { callPicker, refreshIMDb } from "../picker.js";
import { libraryStatus } from "./pick.js";

// Watchlist, pick history and "seen" marks for the logged-in user.
export const libraryRouter = Router();
libraryRouter.use(requireDb, requireAuth);

const titleId = z.string().regex(/^(movie|tv):\d+$/);
// A title snapshot to save. Title pages send the full title; its page-only
// extras (cast, crew, seasons...) and the library tag aren't saved.
const titleBody = z
  .object({ id: titleId, title: z.string() })
  .passthrough()
  .transform(({ details: _details, library: _library, ...snapshot }) => snapshot);

const PAGE_SIZE = 10;

/**
 * Runs a list query one page at a time. `listSql` gets the page size and
 * offset as its last two parameters. Responds with {items, total, page, pageSize}.
 */
async function sendPage(
  req: Request,
  res: Response,
  countSql: string,
  listSql: string,
  params: unknown[],
) {
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(req.query.pageSize)) || PAGE_SIZE));
  const [{ rows: count }, { rows: items }] = await Promise.all([
    pool!.query<{ n: number }>(countSql, params),
    pool!.query(listSql, [...params, pageSize, (page - 1) * pageSize]),
  ]);
  await refreshIMDb(items.map((item) => item.title));
  res.json({ items, total: count[0].n, page, pageSize });
}

// How many items each Library tab has, so the page can label tabs and show an
// empty tab straight away instead of a loading placeholder.
// The Services page: which streaming services carry what's on the user's
// Watchlist and Watching, in their country, plus the services they pay for.
libraryRouter.get("/services", async (req, res) => {
  const userId = req.user!.id;
  const [{ rows: titles }, { rows: user }] = await Promise.all([
    pool!.query<{ title_id: string }>(
      `SELECT title_id FROM (
         SELECT title_id, started_at AS at FROM watching WHERE user_id = $1
         UNION ALL
         SELECT title_id, added_at AS at FROM watchlist WHERE user_id = $1
       ) t ORDER BY at DESC LIMIT 200`,
      [userId],
    ),
    pool!.query<{ region: string; streaming_services: Subscription[] }>(
      "SELECT region, streaming_services FROM users WHERE id = $1",
      [userId],
    ),
  ]);
  const ids = [...new Set(titles.map((t) => t.title_id))];
  const region = user[0]?.region ?? "US";
  const { status, body } = await callPicker("/services", {
    method: "POST",
    body: JSON.stringify({ ids, region }),
  });
  if (status !== 200) {
    res.status(status).json(body);
    return;
  }
  res.json({ report: body, subscribed: user[0]?.streaming_services ?? [] });
});

type Subscription = { key: string; price?: number };

const subscriptions = z.object({
  subscribed: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9-]{1,60}$/),
        // Monthly price in the user's currency; optional.
        price: z.number().min(0).max(500).optional(),
      }),
    )
    .max(40),
});

libraryRouter.put("/services", async (req, res) => {
  const parsed = subscriptions.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid services" });
    return;
  }
  // One entry per service.
  const unique = [...new Map(parsed.data.subscribed.map((s) => [s.key, s])).values()];
  await pool!.query("UPDATE users SET streaming_services = $2 WHERE id = $1", [req.user!.id, JSON.stringify(unique)]);
  res.json({ subscribed: unique });
});

// Where one title is in the user's library: "seen", "watching", "watchlist" or null.
libraryRouter.get("/status/:titleId", async (req, res) => {
  if (!titleId.safeParse(req.params.titleId).success) {
    res.status(400).json({ error: "Invalid title id" });
    return;
  }
  res.json({ status: (await libraryStatus(req.user!.id, req.params.titleId)) ?? null });
});

// ---- Streaming-service filter for the Library tabs ----

type LibraryService = { key: string; name: string; logo?: string; titles: Set<string> };
type ServicesReport = { region: string; services: { key: string; name: string; logo?: string; titles: string[] }[] };

// Which services carry each title in a user's library, per country. Working it
// out means a lookup per title, so it's kept for a few minutes and dropped
// whenever the library changes.
const LIBRARY_SERVICES_TTL = 5 * 60 * 1000;
const libraryServicesCache = new Map<string, { at: number; services: LibraryService[] }>();

libraryRouter.use((req, _res, next) => {
  // A watchlist pick only adds a title that's already in the library to History.
  if (req.method !== "GET" && req.path !== "/watchlist/pick") {
    for (const key of libraryServicesCache.keys()) if (key.startsWith(`${req.user!.id}:`)) libraryServicesCache.delete(key);
  }
  next();
});

async function libraryServices(userId: string): Promise<{ region: string; services: LibraryService[] }> {
  const { rows: user } = await pool!.query<{ region: string }>("SELECT region FROM users WHERE id = $1", [userId]);
  const region = user[0]?.region ?? "US";
  const cacheKey = `${userId}:${region}`;
  const cached = libraryServicesCache.get(cacheKey);
  if (cached && Date.now() - cached.at < LIBRARY_SERVICES_TTL) return { region, services: cached.services };

  const { rows } = await pool!.query<{ title_id: string }>(
    `SELECT title_id FROM (
       SELECT title_id, max(at) AS at FROM (
         SELECT title_id, added_at AS at FROM watchlist WHERE user_id = $1
         UNION ALL SELECT title_id, started_at FROM watching WHERE user_id = $1
         UNION ALL SELECT title_id, seen_at FROM seen WHERE user_id = $1 AND title IS NOT NULL
         UNION ALL SELECT title_id, picked_at FROM history WHERE user_id = $1
       ) all_titles GROUP BY title_id
     ) t ORDER BY at DESC LIMIT 500`,
    [userId],
  );
  const { status, body } = await callPicker("/services", {
    method: "POST",
    body: JSON.stringify({ ids: rows.map((r) => r.title_id), region }),
  });
  if (status !== 200) throw new Error(`picker /services: ${status}`);
  const services = (body as ServicesReport).services.map((s) => ({ ...s, titles: new Set(s.titles) }));
  libraryServicesCache.set(cacheKey, { at: Date.now(), services });
  if (libraryServicesCache.size > 5000) libraryServicesCache.clear();
  return { region, services };
}

const serviceKey = z.string().regex(/^[a-z0-9-]{1,60}$/);

/** Title IDs on the ?service= in the query (null: no filter). */
async function serviceFilter(req: Request): Promise<string[] | null> {
  const key = serviceKey.safeParse(req.query.service);
  if (!key.success) return null;
  const { services } = await libraryServices(req.user!.id);
  return [...(services.find((s) => s.key === key.data)?.titles ?? [])];
}

// Services that carry anything in the library, with how many titles each tab has on them.
libraryRouter.get("/services/library", async (req, res) => {
  const userId = req.user!.id;
  const { region, services } = await libraryServices(userId);
  const tabIds = async (sql: string) => (await pool!.query<{ title_id: string }>(sql, [userId])).rows.map((r) => r.title_id);
  const [watchlist, watching, seen, history] = await Promise.all([
    tabIds("SELECT title_id FROM watchlist WHERE user_id = $1"),
    tabIds("SELECT title_id FROM watching WHERE user_id = $1"),
    tabIds("SELECT title_id FROM seen WHERE user_id = $1 AND title IS NOT NULL"),
    tabIds("SELECT title_id FROM history WHERE user_id = $1"),
  ]);
  const count = (ids: string[], s: LibraryService) => ids.filter((id) => s.titles.has(id)).length;
  res.json({
    region,
    services: services
      .map((s) => ({
        key: s.key,
        name: s.name,
        logo: s.logo,
        counts: {
          watchlist: count(watchlist, s),
          watching: count(watching, s),
          seen: count(seen, s),
          history: count(history, s),
        },
      }))
      .sort((a, b) => b.counts.watchlist + b.counts.watching - (a.counts.watchlist + a.counts.watching) || a.name.localeCompare(b.name)),
  });
});

libraryRouter.get("/counts", async (req, res) => {
  // $2: only titles on this streaming service (null: everything).
  const { rows } = await pool!.query<Record<string, number>>(
    `SELECT
       (SELECT count(*)::int FROM watchlist WHERE user_id = $1 AND ($2::text[] IS NULL OR title_id = ANY($2))) AS watchlist,
       (SELECT count(*)::int FROM watching  WHERE user_id = $1 AND ($2::text[] IS NULL OR title_id = ANY($2))) AS watching,
       (SELECT count(*)::int FROM seen      WHERE user_id = $1 AND title IS NOT NULL AND ($2::text[] IS NULL OR title_id = ANY($2))) AS seen,
       (SELECT count(*)::int FROM history   WHERE user_id = $1 AND ($2::text[] IS NULL OR title_id = ANY($2))) AS history`,
    [req.user!.id, await serviceFilter(req)],
  );
  res.json(rows[0]);
});

libraryRouter.get("/watchlist", async (req, res) => {
  await sendPage(
    req,
    res,
    "SELECT count(*)::int AS n FROM watchlist WHERE user_id = $1 AND ($2::text[] IS NULL OR title_id = ANY($2))",
    `SELECT w.title, w.added_at AS "addedAt", (s.title_id IS NOT NULL) AS seen
       FROM watchlist w
       LEFT JOIN seen s ON s.user_id = w.user_id AND s.title_id = w.title_id
      WHERE w.user_id = $1 AND ($2::text[] IS NULL OR w.title_id = ANY($2))
      ORDER BY w.added_at DESC, w.title_id
      LIMIT $3 OFFSET $4`,
    [req.user!.id, await serviceFilter(req)],
  );
});

libraryRouter.post("/watchlist", async (req, res) => {
  const parsed = titleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid title" });
    return;
  }
  await pool!.query(
    `INSERT INTO watchlist (user_id, title_id, title) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, title_id) DO NOTHING`,
    [req.user!.id, parsed.data.id, parsed.data],
  );
  res.status(201).json({ ok: true });
});

// Random unseen title from the watchlist. `excludeIds` are titles already shown
// this session, so rerolls cycle through the list before repeating.
libraryRouter.post("/watchlist/pick", async (req, res) => {
  const parsed = z.object({ excludeIds: z.array(titleId).max(1000).default([]) }).safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const userId = req.user!.id;
  // ?service=netflix: only titles you can stream there (the Library's filter).
  const onService = await serviceFilter(req);
  const unseen = `FROM watchlist w
     WHERE w.user_id = $1
       AND ($2::text[] IS NULL OR w.title_id = ANY($2))
       AND NOT EXISTS (SELECT 1 FROM seen s WHERE s.user_id = w.user_id AND s.title_id = w.title_id)`;

  const { rows } = await pool!.query<{ title_id: string; title: unknown }>(
    `SELECT w.title_id, w.title ${unseen} AND NOT (w.title_id = ANY($3::text[])) ORDER BY random() LIMIT 1`,
    [userId, onService, parsed.data.excludeIds],
  );
  if (rows[0]) {
    await refreshIMDb([rows[0].title]);
    await pool!.query("INSERT INTO history (user_id, title_id, title) VALUES ($1, $2, $3)", [
      userId,
      rows[0].title_id,
      rows[0].title,
    ]);
    res.json(rows[0].title);
    return;
  }

  const { rows: count } = await pool!.query<{ n: number }>(`SELECT count(*)::int AS n ${unseen}`, [userId, onService]);
  if (count[0].n === 0) {
    res.status(404).json({
      code: "empty",
      error: onService
        ? "Nothing unseen on your watchlist is on that service right now."
        : "Your watchlist has nothing unseen. Save a few picks first.",
    });
  } else {
    res.status(404).json({ code: "exhausted", error: "You've been through your whole watchlist." });
  }
});

libraryRouter.delete("/watchlist/:titleId", async (req, res) => {
  await pool!.query("DELETE FROM watchlist WHERE user_id = $1 AND title_id = $2", [
    req.user!.id,
    req.params.titleId,
  ]);
  res.json({ ok: true });
});

libraryRouter.get("/watching", async (req, res) => {
  await sendPage(
    req,
    res,
    "SELECT count(*)::int AS n FROM watching WHERE user_id = $1 AND ($2::text[] IS NULL OR title_id = ANY($2))",
    `SELECT title, started_at AS "startedAt", false AS seen
       FROM watching
      WHERE user_id = $1 AND ($2::text[] IS NULL OR title_id = ANY($2))
      ORDER BY started_at DESC, title_id
      LIMIT $3 OFFSET $4`,
    [req.user!.id, await serviceFilter(req)],
  );
});

// Starting a title moves it off the watchlist.
libraryRouter.post("/watching", async (req, res) => {
  const parsed = titleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid title" });
    return;
  }
  const client = await pool!.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO watching (user_id, title_id, title) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, title_id) DO NOTHING`,
      [req.user!.id, parsed.data.id, parsed.data],
    );
    await client.query("DELETE FROM watchlist WHERE user_id = $1 AND title_id = $2", [req.user!.id, parsed.data.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  res.status(201).json({ ok: true });
});

libraryRouter.delete("/watching/:titleId", async (req, res) => {
  await pool!.query("DELETE FROM watching WHERE user_id = $1 AND title_id = $2", [
    req.user!.id,
    req.params.titleId,
  ]);
  res.json({ ok: true });
});

libraryRouter.get("/history", async (req, res) => {
  await sendPage(
    req,
    res,
    "SELECT count(*)::int AS n FROM history WHERE user_id = $1 AND ($2::text[] IS NULL OR title_id = ANY($2))",
    `SELECT h.id, h.title, h.picked_at AS "pickedAt", (s.title_id IS NOT NULL) AS seen
       FROM history h
       LEFT JOIN seen s ON s.user_id = h.user_id AND s.title_id = h.title_id
      WHERE h.user_id = $1 AND ($2::text[] IS NULL OR h.title_id = ANY($2))
      ORDER BY h.picked_at DESC, h.id DESC
      LIMIT $3 OFFSET $4`,
    [req.user!.id, await serviceFilter(req)],
  );
});

libraryRouter.delete("/history", async (req, res) => {
  await pool!.query("DELETE FROM history WHERE user_id = $1", [req.user!.id]);
  res.json({ ok: true });
});

libraryRouter.get("/seen", async (req, res) => {
  const userId = req.user!.id;

  // Older marks have no title snapshot: copy one from history or the watchlist...
  await pool!.query(
    `UPDATE seen s
        SET title = COALESCE(
          (SELECT h.title FROM history h WHERE h.user_id = s.user_id AND h.title_id = s.title_id
            ORDER BY h.picked_at DESC LIMIT 1),
          (SELECT w.title FROM watchlist w WHERE w.user_id = s.user_id AND w.title_id = s.title_id))
      WHERE s.user_id = $1 AND s.title IS NULL`,
    [userId],
  );

  // ...and fetch any that are still missing (e.g. marked from a shared link).
  const missing = await pool!.query<{ title_id: string }>(
    "SELECT title_id FROM seen WHERE user_id = $1 AND title IS NULL LIMIT 20",
    [userId],
  );
  if (missing.rows.length > 0) {
    const region = (await pool!.query<{ region: string }>("SELECT region FROM users WHERE id = $1", [userId])).rows[0]
      ?.region;
    await Promise.all(
      missing.rows.map(async ({ title_id }) => {
        const [media, id] = title_id.split(":");
        const { status, body } = await callPicker(`/title/${media}/${id}?region=${region ?? "US"}`).catch(() => ({
          status: 0,
          body: null,
        }));
        if (status === 200) {
          await pool!.query("UPDATE seen SET title = $3 WHERE user_id = $1 AND title_id = $2", [userId, title_id, body]);
        }
      }),
    );
  }

  await sendPage(
    req,
    res,
    "SELECT count(*)::int AS n FROM seen WHERE user_id = $1 AND title IS NOT NULL AND ($2::text[] IS NULL OR title_id = ANY($2))",
    `SELECT s.title, s.seen_at AS "seenAt", true AS seen
       FROM seen s
      WHERE s.user_id = $1 AND s.title IS NOT NULL AND ($2::text[] IS NULL OR s.title_id = ANY($2))
      ORDER BY s.seen_at DESC, s.title_id
      LIMIT $3 OFFSET $4`,
    [userId, await serviceFilter(req)],
  );
});

libraryRouter.put("/seen/:titleId", async (req, res) => {
  if (!titleId.safeParse(req.params.titleId).success) {
    res.status(400).json({ error: "Invalid title id" });
    return;
  }
  // The client sends the title so the Seen tab can show it; it's optional.
  const body = titleBody.safeParse(req.body);
  const title = body.success && body.data.id === req.params.titleId ? body.data : null;
  await pool!.query(
    `INSERT INTO seen (user_id, title_id, title) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, title_id) DO UPDATE SET title = COALESCE(EXCLUDED.title, seen.title)`,
    [req.user!.id, req.params.titleId, title],
  );
  // Seen means finished, so it's no longer in progress.
  await pool!.query("DELETE FROM watching WHERE user_id = $1 AND title_id = $2", [req.user!.id, req.params.titleId]);
  res.json({ ok: true });
});

libraryRouter.delete("/seen/:titleId", async (req, res) => {
  await pool!.query("DELETE FROM seen WHERE user_id = $1 AND title_id = $2", [req.user!.id, req.params.titleId]);
  res.json({ ok: true });
});
