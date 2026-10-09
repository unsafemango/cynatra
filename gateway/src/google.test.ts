// Runs against the Postgres in DATABASE_URL; every test is rolled back.
import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, test } from "node:test";
import pg from "pg";
import { migrate, pool } from "./db/index.js";
import { findOrCreateGoogleUser, GoogleAuthError } from "./google.js";

let db: pg.PoolClient;

before(async () => {
  if (!pool) throw new Error("Set DATABASE_URL to run these tests");
  await migrate();
});
after(async () => {
  await pool?.end();
});
beforeEach(async () => {
  db = await pool!.connect();
  await db.query("BEGIN");
});
afterEach(async () => {
  await db.query("ROLLBACK");
  db.release();
});

const email = "google-test@example.test";
const profile = { sub: "google-sub-1", email, emailVerified: true };

test("first Google sign-in creates a passwordless user", async () => {
  const user = await findOrCreateGoogleUser(db, profile);
  assert.equal(user.created, true);
  assert.equal(user.email, email);
  const { rows } = await db.query("SELECT password_hash, google_id FROM users WHERE id = $1", [user.id]);
  assert.equal(rows[0].password_hash, null);
  assert.equal(rows[0].google_id, "google-sub-1");
});

test("signing in again returns the same user", async () => {
  const first = await findOrCreateGoogleUser(db, profile);
  const second = await findOrCreateGoogleUser(db, profile);
  assert.equal(second.id, first.id);
  assert.equal(second.created, false);
});

test("links Google to an existing email/password account", async () => {
  const { rows } = await db.query("INSERT INTO users (email, password_hash) VALUES ($1, 'hash') RETURNING id", [email]);
  const user = await findOrCreateGoogleUser(db, profile);
  assert.equal(user.id, rows[0].id);
  assert.equal(user.created, false);
  const after = await db.query("SELECT password_hash, google_id FROM users WHERE id = $1", [user.id]);
  assert.equal(after.rows[0].password_hash, "hash", "password login keeps working");
  assert.equal(after.rows[0].google_id, "google-sub-1");
});

test("won't link an unverified Google email to an existing account", async () => {
  await db.query("INSERT INTO users (email, password_hash) VALUES ($1, 'hash')", [email]);
  await assert.rejects(findOrCreateGoogleUser(db, { ...profile, emailVerified: false }), (err) => {
    assert.ok(err instanceof GoogleAuthError);
    assert.equal(err.status, 403);
    return true;
  });
});

test("won't take over an email linked to a different Google account", async () => {
  await findOrCreateGoogleUser(db, profile);
  await assert.rejects(findOrCreateGoogleUser(db, { ...profile, sub: "google-sub-2" }), (err) => {
    assert.ok(err instanceof GoogleAuthError);
    assert.equal(err.status, 409);
    return true;
  });
});
