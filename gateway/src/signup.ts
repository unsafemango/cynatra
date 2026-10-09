import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { config } from "./config.js";
import type { AccountUser } from "./google.js";

// Email/password sign-up happens in two steps: start (store a pending sign-up
// and email a 6-digit code), then verify (code matches → create the user).
// Nothing is added to `users` until the email is confirmed.

export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;

type Db = Pool | PoolClient;
export type SendCode = (email: string, code: string, minutes: number) => Promise<void>;

export class SignupError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

// Keyed hash so a leaked database row doesn't reveal the code.
const hashCode = (email: string, code: string) =>
  crypto.createHmac("sha256", config.jwtSecret).update(`${email}:${code}`).digest("hex");

const sameHash = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function assertEmailFree(db: Db, email: string) {
  const { rows } = await db.query<{ password_hash: string | null }>(
    "SELECT password_hash FROM users WHERE email = $1",
    [email],
  );
  if (rows[0]) {
    throw new SignupError(
      rows[0].password_hash
        ? "That email is already registered."
        : "This email signs in with Google. Use “Continue with Google” instead.",
      409,
    );
  }
}

/** Emails a code; on failure, lets the person retry right away instead of waiting out the cooldown. */
async function deliver(db: Db, email: string, code: string, send: SendCode) {
  try {
    await send(email, code, CODE_TTL_MINUTES);
  } catch (err) {
    await db.query("UPDATE pending_signups SET last_sent_at = to_timestamp(0) WHERE email = $1", [email]);
    console.error("sending sign-up code failed:", err);
    throw new SignupError("We couldn't send the email. Please try again.", 502);
  }
}

const tooSoon = () => new SignupError("Please wait a minute before requesting another code.", 429);

export async function startSignup(db: Db, email: string, passwordHash: string, send: SendCode) {
  await assertEmailFree(db, email);
  // Tidy up abandoned sign-ups.
  await db.query("DELETE FROM pending_signups WHERE expires_at < now() - interval '1 day'");
  const code = newCode();
  // Starting again replaces an earlier attempt (new password, new code), but at
  // most one code per cooldown window, enforced atomically.
  const { rows } = await db.query(
    `INSERT INTO pending_signups (email, password_hash, code_hash, expires_at, attempts, last_sent_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4), 0, now())
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash, code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at, attempts = 0, last_sent_at = now()
     WHERE pending_signups.last_sent_at < now() - make_interval(secs => $5)
     RETURNING email`,
    [email, passwordHash, hashCode(email, code), CODE_TTL_MINUTES, RESEND_COOLDOWN_SECONDS],
  );
  if (!rows[0]) throw tooSoon();
  await deliver(db, email, code, send);
}

export async function resendCode(db: Db, email: string, send: SendCode) {
  const code = newCode();
  const { rows } = await db.query(
    `UPDATE pending_signups SET code_hash = $2, expires_at = now() + make_interval(mins => $3),
       attempts = 0, last_sent_at = now()
     WHERE email = $1 AND last_sent_at < now() - make_interval(secs => $4)
     RETURNING email`,
    [email, hashCode(email, code), CODE_TTL_MINUTES, RESEND_COOLDOWN_SECONDS],
  );
  if (!rows[0]) {
    const exists = await db.query("SELECT 1 FROM pending_signups WHERE email = $1", [email]);
    if (!exists.rows[0]) throw new SignupError("No sign-up in progress for this email. Please start again.", 404);
    throw tooSoon();
  }
  await deliver(db, email, code, send);
}

/** Checks the code; on success creates the user and removes the pending sign-up. */
export async function verifySignup(db: Db, email: string, code: string): Promise<AccountUser> {
  // Count the attempt first, atomically, so guesses can't race past the limit.
  const { rows } = await db.query<{ code_hash: string; password_hash: string; expired: boolean; attempts: number }>(
    `UPDATE pending_signups SET attempts = attempts + 1 WHERE email = $1
     RETURNING code_hash, password_hash, (expires_at < now()) AS expired, attempts`,
    [email],
  );
  const pending = rows[0];
  if (!pending) throw new SignupError("No sign-up in progress for this email. Please start again.", 404);
  if (pending.expired) throw new SignupError("That code has expired. Request a new one.", 410);
  if (pending.attempts > MAX_ATTEMPTS) throw new SignupError("Too many wrong codes. Request a new one.", 429);
  if (!sameHash(pending.code_hash, hashCode(email, code))) {
    const left = MAX_ATTEMPTS - pending.attempts;
    throw new SignupError(
      left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Request a new one.",
      left > 0 ? 400 : 429,
    );
  }

  const created = await db.query<AccountUser>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING RETURNING id, email, region`,
    [email, pending.password_hash],
  );
  await db.query("DELETE FROM pending_signups WHERE email = $1", [email]);
  // Someone created this account another way (e.g. Google) in the meantime.
  if (!created.rows[0]) await assertEmailFree(db, email);
  return created.rows[0];
}
