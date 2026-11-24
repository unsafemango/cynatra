// Runs against the Postgres in DATABASE_URL; every test is rolled back.
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import pg from "pg";
import { migrate, pool } from "./db/index.js";
import { leadPeople, setReaction } from "./reactions.js";
import { loadTaste } from "./taste.js";

let db: pg.PoolClient;
let userId: string;

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
    "INSERT INTO users (email, password_hash) VALUES ('taste-test@example.test', 'hash') RETURNING id",
  );
  userId = rows[0].id;
});
afterEach(async () => {
  await db.query("ROLLBACK");
  db.release();
});

const seen = (id: string, title: object | null, people: object[] | null = null) =>
  db.query("INSERT INTO seen (user_id, title_id, title, people) VALUES ($1, $2, $3, $4)", [
    userId,
    id,
    title,
    people && JSON.stringify(people),
  ]);

test("a user with no ratings has an empty profile", async () => {
  await seen("movie:1", { genres: ["Drama"], year: 2000 });
  assert.equal((await loadTaste(db, userId)).ratings, 0);
});

test("the profile is built from rated titles only", async () => {
  await seen("movie:1", { genres: ["Sci-Fi", "Action"], year: 1999 }, [{ id: 7, name: "Lana" }]);
  await seen("movie:2", { genres: ["Romance"], year: 2012 });
  await seen("movie:3", { genres: ["Horror"], year: 1980 });
  await setReaction(db, userId, "movie:1", "like");
  await setReaction(db, userId, "movie:2", "dislike");

  const t = await loadTaste(db, userId);
  assert.equal(t.ratings, 2);
  assert.deepEqual(t.genres.map((g) => g.key).sort(), ["Action", "Romance", "Sci-Fi"]);
  assert.deepEqual(t.decades.map((d) => [d.key, d.weight]).sort(), [[1990, 1], [2010, -1]]);
  assert.deepEqual(t.people.map((p) => p.name), ["Lana"]);
});

test("clearing a rating removes it from the profile", async () => {
  await seen("movie:1", { genres: ["Drama"], year: 2000 });
  await setReaction(db, userId, "movie:1", "like");
  await setReaction(db, userId, "movie:1", null);
  assert.deepEqual(await loadTaste(db, userId), { ratings: 0, genres: [], decades: [], people: [] });
});

test("a rated title with no saved snapshot still counts as a rating", async () => {
  await seen("movie:1", null);
  await setReaction(db, userId, "movie:1", "like");
  const t = await loadTaste(db, userId);
  assert.equal(t.ratings, 1);
  assert.deepEqual(t.genres, []);
});

test("other users' ratings don't leak in", async () => {
  const { rows } = await db.query(
    "INSERT INTO users (email, password_hash) VALUES ('taste-other@example.test', 'hash') RETURNING id",
  );
  await db.query("INSERT INTO seen (user_id, title_id, title) VALUES ($1, 'movie:9', '{\"genres\":[\"Western\"]}')", [rows[0].id]);
  await setReaction(db, rows[0].id, "movie:9", "like");
  assert.equal((await loadTaste(db, userId)).ratings, 0);
});

test("leadPeople keeps directors and the top-billed cast without repeats", () => {
  const cast = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Actor ${i + 1}`, character: "x" }));
  const people = leadPeople({
    cast,
    crew: [
      { job: "Director", people: [{ id: 3, name: "Actor 3" }, { id: 100, name: "Dir" }] },
      { job: "Editor", people: [{ id: 200, name: "Ed" }] },
    ],
  });
  assert.deepEqual(people.map((p) => p.id), [3, 100, 1, 2, 4, 5]);
  assert.deepEqual(leadPeople({}), []);
});
