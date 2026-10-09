import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireDb, signToken } from "../auth.js";
import { pool } from "../db/index.js";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

authRouter.post("/register", requireDb, async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool!.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [email, hash],
  );
  if (!rows[0]) {
    res.status(409).json({ error: "That email is already registered." });
    return;
  }
  const user = { id: rows[0].id, email };
  res.status(201).json({ token: signToken(user), user: { ...user, region: "US" } });
});

authRouter.post("/login", requireDb, async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password." });
    return;
  }
  const { email, password } = parsed.data;
  const { rows } = await pool!.query<{ id: string; password_hash: string; region: string }>(
    "SELECT id, password_hash, region FROM users WHERE email = $1",
    [email],
  );
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  const user = { id: row.id, email };
  res.json({ token: signToken(user), user: { ...user, region: row.region } });
});

authRouter.get("/me", requireDb, requireAuth, async (req, res) => {
  const { rows } = await pool!.query("SELECT id, email, region FROM users WHERE id = $1", [req.user!.id]);
  if (!rows[0]) {
    res.status(401).json({ error: "Account not found." });
    return;
  }
  res.json({ user: rows[0] });
});

authRouter.patch("/me", requireDb, requireAuth, async (req, res) => {
  const parsed = z.object({ region: z.string().regex(/^[A-Za-z]{2}$/) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Region must be a 2-letter country code." });
    return;
  }
  const { rows } = await pool!.query(
    "UPDATE users SET region = $2 WHERE id = $1 RETURNING id, email, region",
    [req.user!.id, parsed.data.region.toUpperCase()],
  );
  res.json({ user: rows[0] });
});
