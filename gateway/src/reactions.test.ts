// Runs against the Postgres in DATABASE_URL; every test is rolled back.
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import pg from "pg";
import { migrate, pool } from "./db/index.js";
import { getReaction, setReaction } from "./reactions.js";

let db: pg.PoolClient;
let userId: string;
const movie = "movie:603";

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
  const { rows } = await db.query(
    "INSERT INTO users (email, password_hash) VALUES ('reactions-test@example.test', 'hash') RETURNING id",
  );
  userId = rows[0].id;
});
afterEach(async () => {
  await db.query("ROLLBACK");
  db.release();
});

const markSeen = (id = movie) => db.query("INSERT INTO seen (user_id, title_id) VALUES ($1, $2)", [userId, id]);

test("a seen title can be liked, switched to a dislike, and cleared", async () => {
  await markSeen();
  assert.equal(await getReaction(db, userId, movie), null);

  assert.equal(await setReaction(db, userId, movie, "like"), true);
  assert.equal(await getReaction(db, userId, movie), "like");

  assert.equal(await setReaction(db, userId, movie, "dislike"), true);
  assert.equal(await getReaction(db, userId, movie), "dislike");

  assert.equal(await setReaction(db, userId, movie, null), true);
  assert.equal(await getReaction(db, userId, movie), null);
  const { rows } = await db.query("SELECT reacted_at FROM seen WHERE user_id = $1", [userId]);
  assert.equal(rows[0].reacted_at, null, "clearing also clears the timestamp");
});

test("a title that isn't seen can't be rated", async () => {
  assert.equal(await setReaction(db, userId, movie, "like"), false);
  const { rows } = await db.query("SELECT 1 FROM seen WHERE user_id = $1", [userId]);
  assert.equal(rows.length, 0, "rating doesn't mark the title seen");
});

test("reactions are per user and per title", async () => {
  await markSeen();
  await markSeen("tv:1399");
  const { rows } = await db.query(
    "INSERT INTO users (email, password_hash) VALUES ('reactions-other@example.test', 'hash') RETURNING id",
  );
  await db.query("INSERT INTO seen (user_id, title_id) VALUES ($1, $2)", [rows[0].id, movie]);

  await setReaction(db, userId, movie, "like");
  assert.equal(await getReaction(db, userId, "tv:1399"), null);
  assert.equal(await getReaction(db, rows[0].id, movie), null);
});

test("only like and dislike are stored", async () => {
  await markSeen();
  await db.query("SAVEPOINT s");
  await assert.rejects(db.query("UPDATE seen SET reaction = 'meh' WHERE user_id = $1", [userId]));
  await db.query("ROLLBACK TO SAVEPOINT s");
});

test("removing a title from Seen drops its reaction", async () => {
  await markSeen();
  await setReaction(db, userId, movie, "like");
  await db.query("DELETE FROM seen WHERE user_id = $1 AND title_id = $2", [userId, movie]);
  assert.equal(await getReaction(db, userId, movie), null);
});

test("marking a title seen again keeps its reaction", async () => {
  await markSeen();
  await setReaction(db, userId, movie, "like");
  await db.query(
    `INSERT INTO seen (user_id, title_id, title) VALUES ($1, $2, '{"id":"movie:603","title":"The Matrix"}')
     ON CONFLICT (user_id, title_id) DO UPDATE SET title = COALESCE(EXCLUDED.title, seen.title)`,
    [userId, movie],
  );
  assert.equal(await getReaction(db, userId, movie), "like");
});
