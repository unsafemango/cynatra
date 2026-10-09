import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireDb } from "../auth.js";
import { pool } from "../db/index.js";

// Watchlist, pick history and "seen" marks for the logged-in user.
export const libraryRouter = Router();
libraryRouter.use(requireDb, requireAuth);

const titleId = z.string().regex(/^(movie|tv):\d+$/);
const titleBody = z.object({ id: titleId, title: z.string() }).passthrough();

libraryRouter.get("/watchlist", async (req, res) => {
  const { rows } = await pool!.query(
    `SELECT w.title, w.added_at AS "addedAt", (s.title_id IS NOT NULL) AS seen
       FROM watchlist w
       LEFT JOIN seen s ON s.user_id = w.user_id AND s.title_id = w.title_id
      WHERE w.user_id = $1
      ORDER BY w.added_at DESC`,
    [req.user!.id],
  );
  res.json({ items: rows });
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

libraryRouter.delete("/watchlist/:titleId", async (req, res) => {
  await pool!.query("DELETE FROM watchlist WHERE user_id = $1 AND title_id = $2", [
    req.user!.id,
    req.params.titleId,
  ]);
  res.json({ ok: true });
});

libraryRouter.get("/history", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await pool!.query(
    `SELECT h.id, h.title, h.picked_at AS "pickedAt", (s.title_id IS NOT NULL) AS seen
       FROM history h
       LEFT JOIN seen s ON s.user_id = h.user_id AND s.title_id = h.title_id
      WHERE h.user_id = $1
      ORDER BY h.picked_at DESC
      LIMIT $2`,
    [req.user!.id, limit],
  );
  res.json({ items: rows });
});

libraryRouter.delete("/history", async (req, res) => {
  await pool!.query("DELETE FROM history WHERE user_id = $1", [req.user!.id]);
  res.json({ ok: true });
});

libraryRouter.put("/seen/:titleId", async (req, res) => {
  if (!titleId.safeParse(req.params.titleId).success) {
    res.status(400).json({ error: "Invalid title id" });
    return;
  }
  await pool!.query("INSERT INTO seen (user_id, title_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    req.user!.id,
    req.params.titleId,
  ]);
  res.json({ ok: true });
});

libraryRouter.delete("/seen/:titleId", async (req, res) => {
  await pool!.query("DELETE FROM seen WHERE user_id = $1 AND title_id = $2", [req.user!.id, req.params.titleId]);
  res.json({ ok: true });
});
