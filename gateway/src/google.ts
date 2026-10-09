import { OAuth2Client } from "google-auth-library";
import type { Pool, PoolClient } from "pg";
import { config } from "./config.js";

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean };
export type AccountUser = { id: string; email: string; region: string };

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const client = new OAuth2Client();

/**
 * Checks a "Sign in with Google" ID token: signed by Google, issued for our
 * client ID, not expired. Returns who it is for.
 */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  if (!config.googleClientId) throw new GoogleAuthError("Google sign-in isn't set up.", 503);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw new GoogleAuthError("Google sign-in failed. Please try again.", 401);
  }
  if (!payload?.sub || !payload.email) throw new GoogleAuthError("Google didn't share an email address.", 401);
  return { sub: payload.sub, email: payload.email.toLowerCase(), emailVerified: payload.email_verified === true };
}

/**
 * Finds the user for a Google account, creating one if needed.
 * - Signed in with this Google account before: that user.
 * - An account with the same (Google-verified) email exists: link Google to it,
 *   so an email/password user keeps their watchlist and history.
 * - Otherwise: a new user with no password.
 */
export async function findOrCreateGoogleUser(
  db: Pool | PoolClient,
  profile: GoogleProfile,
): Promise<AccountUser & { created: boolean }> {
  const existing = await db.query<AccountUser>("SELECT id, email, region FROM users WHERE google_id = $1", [
    profile.sub,
  ]);
  if (existing.rows[0]) return { ...existing.rows[0], created: false };

  // Linking by email is only safe when Google has verified the address.
  if (!profile.emailVerified) throw new GoogleAuthError("Please verify your Google email address first.", 403);

  // One statement so two simultaneous first sign-ins can't create duplicates.
  const { rows } = await db.query<AccountUser & { created: boolean }>(
    `INSERT INTO users (email, google_id) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET google_id = EXCLUDED.google_id
       WHERE users.google_id IS NULL
     RETURNING id, email, region, (xmax = 0) AS created`,
    [profile.email, profile.sub],
  );
  if (!rows[0]) {
    throw new GoogleAuthError("This email is already linked to a different Google account.", 409);
  }
  return rows[0];
}
