import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireDb } from "../auth.js";
import { pool } from "../db/index.js";
import { callPicker } from "../picker.js";

// Watchlist, pick history and "seen" marks for the logged-in user.
export const libraryRouter = Router();
libraryRouter.use(requireDb, requireAuth);

const titleId = z.string().regex(/^(movie|tv):\d+$/);
const titleBody = z.object({ id: titleId, title: z.string() }).passthrough();

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
  res.json({ items, total: count[0].n, page, pageSize });
}

// How many items each Library tab has, so the page can label tabs and show an
// empty tab straight away instead of a loading placeholder.
libraryRouter.get("/counts", async (req, res) => {
  const { rows } = await pool!.query<Record<string, number>>(
    `SELECT
       (SELECT count(*)::int FROM watchlist WHERE user_id = $1) AS watchlist,
       (SELECT count(*)::int FROM watching  WHERE user_id = $1) AS watching,
       (SELECT count(*)::int FROM seen      WHERE user_id = $1 AND title IS NOT NULL) AS seen,
       (SELECT count(*)::int FROM history   WHERE user_id = $1) AS history`,
    [req.user!.id],
  );
  res.json(rows[0]);
});

libraryRouter.get("/watchlist", async (req, res) => {
  await sendPage(
    req,
    res,
    "SELECT count(*)::int AS n FROM watchlist WHERE user_id = $1",
    `SELECT w.title, w.added_at AS "addedAt", (s.title_id IS NOT NULL) AS seen
       FROM watchlist w
       LEFT JOIN seen s ON s.user_id = w.user_id AND s.title_id = w.title_id
      WHERE w.user_id = $1
      ORDER BY w.added_at DESC, w.title_id
      LIMIT $2 OFFSET $3`,
    [req.user!.id],
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
  const unseen = `FROM watchlist w
     WHERE w.user_id = $1
       AND NOT EXISTS (SELECT 1 FROM seen s WHERE s.user_id = w.user_id AND s.title_id = w.title_id)`;

  const { rows } = await pool!.query<{ title_id: string; title: unknown }>(
    `SELECT w.title_id, w.title ${unseen} AND NOT (w.title_id = ANY($2::text[])) ORDER BY random() LIMIT 1`,
    [userId, parsed.data.excludeIds],
  );
  if (rows[0]) {
    await pool!.query("INSERT INTO history (user_id, title_id, title) VALUES ($1, $2, $3)", [
      userId,
      rows[0].title_id,
      rows[0].title,
    ]);
    res.json(rows[0].title);
    return;
  }

  const { rows: count } = await pool!.query<{ n: number }>(`SELECT count(*)::int AS n ${unseen}`, [userId]);
  if (count[0].n === 0) {
    res.status(404).json({ code: "empty", error: "Your watchlist has nothing unseen. Save a few picks first." });
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
    "SELECT count(*)::int AS n FROM watching WHERE user_id = $1",
    `SELECT title, started_at AS "startedAt", false AS seen
       FROM watching
      WHERE user_id = $1
      ORDER BY started_at DESC, title_id
      LIMIT $2 OFFSET $3`,
    [req.user!.id],
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
    "SELECT count(*)::int AS n FROM history WHERE user_id = $1",
    `SELECT h.id, h.title, h.picked_at AS "pickedAt", (s.title_id IS NOT NULL) AS seen
       FROM history h
       LEFT JOIN seen s ON s.user_id = h.user_id AND s.title_id = h.title_id
      WHERE h.user_id = $1
      ORDER BY h.picked_at DESC, h.id DESC
      LIMIT $2 OFFSET $3`,
    [req.user!.id],
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
    "SELECT count(*)::int AS n FROM seen WHERE user_id = $1 AND title IS NOT NULL",
    `SELECT s.title, s.seen_at AS "seenAt", true AS seen
       FROM seen s
      WHERE s.user_id = $1 AND s.title IS NOT NULL
      ORDER BY s.seen_at DESC, s.title_id
      LIMIT $2 OFFSET $3`,
    [userId],
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
