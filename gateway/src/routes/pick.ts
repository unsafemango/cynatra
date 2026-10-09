import { Router } from "express";
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
});

pickRouter.get("/genres", async (_req, res) => {
  const { status, body } = await callPicker("/genres");
  res.status(status).json(body);
});

pickRouter.get("/title/:media/:id", async (req, res) => {
  const { media, id } = req.params;
  if (!/^(movie|tv)$/.test(media) || !/^\d+$/.test(id)) {
    res.status(400).json({ error: "Invalid title" });
    return;
  }
  const region = /^[A-Za-z]{2}$/.test(String(req.query.region)) ? String(req.query.region) : "US";
  const { status, body } = await callPicker(`/title/${media}/${id}?region=${region}`);
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
      const { rows } = await pool.query<{ title_id: string }>(
        "SELECT title_id FROM seen WHERE user_id = $1",
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
  }
  res.status(status).json(body);
});
