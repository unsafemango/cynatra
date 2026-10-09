// Runs against the Postgres in DATABASE_URL; every test is rolled back.
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import pg from "pg";
import { migrate, pool } from "./db/index.js";
import { MAX_ATTEMPTS, resendCode, SignupError, startSignup, verifySignup } from "./signup.js";

let db: pg.PoolClient;
let sent: { email: string; code: string }[];
const send = async (email: string, code: string) => {
  sent.push({ email, code });
};
const email = "signup-test@example.test";
const lastCode = () => sent.at(-1)!.code;
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

async function rejectsWith(p: Promise<unknown>, status: number) {
  await assert.rejects(p, (err) => {
    assert.ok(err instanceof SignupError, String(err));
    assert.equal(err.status, status, err.message);
    return true;
  });
}

before(async () => {
  if (!pool) throw new Error("Set DATABASE_URL to run these tests");
  await migrate();
});
after(async () => {
  await pool?.end();
});
beforeEach(async () => {
  sent = [];
  db = await pool!.connect();
  await db.query("BEGIN");
});
afterEach(async () => {
  await db.query("ROLLBACK");
  db.release();
});

const userCount = async () => (await db.query("SELECT count(*)::int AS n FROM users WHERE email = $1", [email])).rows[0].n;

test("no user exists until the emailed code is confirmed", async () => {
  await startSignup(db, email, "hash", send);
  assert.equal(sent.length, 1);
  assert.match(lastCode(), /^\d{6}$/);
  assert.equal(await userCount(), 0);

  const user = await verifySignup(db, email, lastCode());
  assert.equal(user.email, email);
  assert.equal(await userCount(), 1);
  const { rows } = await db.query("SELECT 1 FROM pending_signups WHERE email = $1", [email]);
  assert.equal(rows.length, 0, "pending sign-up is cleared");
});

test("codes are stored hashed, not in plain text", async () => {
  await startSignup(db, email, "hash", send);
  const { rows } = await db.query("SELECT code_hash FROM pending_signups WHERE email = $1", [email]);
  assert.notEqual(rows[0].code_hash, lastCode());
  assert.ok(!rows[0].code_hash.includes(lastCode()));
});

test("a wrong code is rejected and counts down the tries", async () => {
  await startSignup(db, email, "hash", send);
  await assert.rejects(verifySignup(db, email, wrong(lastCode())), /4 tries left/);
  assert.equal(await userCount(), 0);
});

test(`after ${MAX_ATTEMPTS} wrong codes even the right one is refused`, async () => {
  await startSignup(db, email, "hash", send);
  const code = lastCode();
  for (let i = 0; i < MAX_ATTEMPTS; i++) await assert.rejects(verifySignup(db, email, wrong(code)));
  await rejectsWith(verifySignup(db, email, code), 429);
  assert.equal(await userCount(), 0);
});

test("an expired code is refused", async () => {
  await startSignup(db, email, "hash", send);
  await db.query("UPDATE pending_signups SET expires_at = now() - interval '1 second' WHERE email = $1", [email]);
  await rejectsWith(verifySignup(db, email, lastCode()), 410);
});

test("resend is rate limited, then issues a new code that replaces the old one", async () => {
  await startSignup(db, email, "hash", send);
  const first = lastCode();
  await rejectsWith(resendCode(db, email, send), 429);
  await rejectsWith(startSignup(db, email, "hash", send), 429);

  await db.query("UPDATE pending_signups SET last_sent_at = now() - interval '2 minutes' WHERE email = $1", [email]);
  await resendCode(db, email, send);
  const second = lastCode();
  if (second !== first) await assert.rejects(verifySignup(db, email, first), /isn't right/);
  const user = await verifySignup(db, email, second);
  assert.equal(user.email, email);
});

test("resend without a sign-up in progress", async () => {
  await rejectsWith(resendCode(db, email, send), 404);
});

test("can't start a sign-up for an existing account", async () => {
  await db.query("INSERT INTO users (email, password_hash) VALUES ($1, 'hash')", [email]);
  await rejectsWith(startSignup(db, email, "hash", send), 409);
  assert.equal(sent.length, 0, "no email sent");
});

test("a failed email can be retried straight away", async () => {
  await rejectsWith(
    startSignup(db, email, "hash", async () => {
      throw new Error("smtp down");
    }),
    502,
  );
  await startSignup(db, email, "hash", send);
  assert.equal(sent.length, 1);
});

test("if the email got an account another way meanwhile, verify refuses", async () => {
  await startSignup(db, email, "hash", send);
  await db.query("INSERT INTO users (email, google_id) VALUES ($1, 'g-1')", [email]);
  await rejectsWith(verifySignup(db, email, lastCode()), 409);
  assert.equal(await userCount(), 1);
});
