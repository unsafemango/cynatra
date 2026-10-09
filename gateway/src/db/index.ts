import pg from "pg";
import { config } from "../config.js";

// Accounts, watchlists and history need Postgres. Without DATABASE_URL the
// gateway still serves anonymous spins and the account routes return 503.
export const pool = config.databaseUrl ? new pg.Pool({ connectionString: config.databaseUrl }) : null;

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  region        text NOT NULL DEFAULT 'US',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id text NOT NULL,
  title    jsonb NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);

CREATE TABLE IF NOT EXISTS history (
  id        bigserial PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id  text NOT NULL,
  title     jsonb NOT NULL,
  picked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS history_user_picked ON history (user_id, picked_at DESC);

CREATE TABLE IF NOT EXISTS seen (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id text NOT NULL,
  seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);
-- Title snapshot for the Seen tab. Nullable: older marks stored only the ID
-- and are filled in on read.
ALTER TABLE seen ADD COLUMN IF NOT EXISTS title jsonb;
CREATE INDEX IF NOT EXISTS seen_user_seen_at ON seen (user_id, seen_at DESC);
`;

export async function migrate() {
  if (!pool) return;
  await pool.query(schema);
}
