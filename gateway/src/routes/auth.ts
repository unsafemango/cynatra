import bcrypt from "bcryptjs";
import { limiter, perIp } from "../rate-limit.js";
import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireDb, signToken } from "../auth.js";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import { findOrCreateGoogleUser, GoogleAuthError, verifyGoogleCredential } from "../google.js";
import { sendSignupCode } from "../mailer.js";
import { CODE_TTL_MINUTES, RESEND_COOLDOWN_SECONDS, resendCode, SignupError, startSignup, verifySignup } from "../signup.js";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

// Step 1 of email sign-up: email a code. No account exists until step 2.
// Limits on guessing: per visitor IP, and per account for logins (so spreading
// attempts over many IPs doesn't help either).
const FIFTEEN_MIN = 15 * 60 * 1000;
const authPerIp = perIp(15, FIFTEEN_MIN, "Too many attempts. Please wait a few minutes and try again.");
const loginPerIp = perIp(10, FIFTEEN_MIN, "Too many login attempts. Please wait a few minutes and try again.");
const loginPerAccount = limiter(10, FIFTEEN_MIN);

authRouter.post("/register", requireDb, authPerIp, async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  await withSignupErrors(res, async () => {
    await startSignup(pool!, email, await bcrypt.hash(password, 10), sendSignupCode);
    res.status(202).json({ email, expiresInMinutes: CODE_TTL_MINUTES, resendAfterSeconds: RESEND_COOLDOWN_SECONDS });
  });
});

// Step 2: the emailed code creates the account and signs in.
authRouter.post("/register/verify", requireDb, authPerIp, async (req, res) => {
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email(), code: z.string().trim().regex(/^\d{6}$/) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit code from the email." });
    return;
  }
  await withSignupErrors(res, async () => {
    const user = await verifySignup(pool!, parsed.data.email, parsed.data.code);
    res.status(201).json({ token: signToken(user), user });
  });
});

authRouter.post("/register/resend", requireDb, authPerIp, async (req, res) => {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email." });
    return;
  }
  await withSignupErrors(res, async () => {
    await resendCode(pool!, parsed.data.email, sendSignupCode);
    res.status(202).json({ email: parsed.data.email, resendAfterSeconds: RESEND_COOLDOWN_SECONDS });
  });
});

async function withSignupErrors(res: Response, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof SignupError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

authRouter.post("/login", requireDb, loginPerIp, async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password." });
    return;
  }
  const { email, password } = parsed.data;
  if (!loginPerAccount(email)) {
    res.setHeader("Retry-After", String(FIFTEEN_MIN / 1000));
    res.status(429).json({ error: "Too many login attempts for this account. Please wait a few minutes and try again." });
    return;
  }
  const { rows } = await pool!.query<{ id: string; password_hash: string | null; region: string }>(
    "SELECT id, password_hash, region FROM users WHERE email = $1",
    [email],
  );
  const row = rows[0];
  if (row && !row.password_hash) {
    res.status(401).json({ error: "This account uses Google sign-in. Use “Continue with Google” instead." });
    return;
  }
  if (!row || !(await bcrypt.compare(password, row.password_hash!))) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  const user = { id: row.id, email };
  res.json({ token: signToken(user), user: { ...user, region: row.region } });
});

// What sign-in options the frontend should offer.
authRouter.get("/config", (_req, res) => {
  res.json({ accounts: Boolean(pool), googleClientId: pool ? (config.googleClientId ?? null) : null });
});

authRouter.post("/google", requireDb, authPerIp, async (req, res) => {
  const parsed = z.object({ credential: z.string().min(20).max(5000) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing Google credential." });
    return;
  }
  try {
    const profile = await verifyGoogleCredential(parsed.data.credential);
    const { created, ...user } = await findOrCreateGoogleUser(pool!, profile);
    res.status(created ? 201 : 200).json({ token: signToken(user), user });
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Profile fields: how the account signs in and when it was created.
const ME_COLUMNS = `id, email, region, created_at AS "createdAt",
  (password_hash IS NOT NULL) AS "hasPassword", (google_id IS NOT NULL) AS "hasGoogle"`;

authRouter.get("/me", requireDb, requireAuth, async (req, res) => {
  const { rows } = await pool!.query(`SELECT ${ME_COLUMNS} FROM users WHERE id = $1`, [req.user!.id]);
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
    `UPDATE users SET region = $2 WHERE id = $1 RETURNING ${ME_COLUMNS}`,
    [req.user!.id, parsed.data.region.toUpperCase()],
  );
  res.json({ user: rows[0] });
});
