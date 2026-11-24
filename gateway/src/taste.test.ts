import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTaste, decadeOf } from "./taste.js";

const nolan = { id: 525, name: "Christopher Nolan" };

test("no ratings gives an empty profile", () => {
  assert.deepEqual(buildTaste([]), { ratings: 0, genres: [], decades: [], people: [] });
});

test("likes push traits up and dislikes push them down", () => {
  const t = buildTaste([
    { reaction: "like", genres: ["Sci-Fi"], year: 1999, people: [nolan] },
    { reaction: "dislike", genres: ["Romance"], year: 2015, people: [] },
  ]);
  assert.deepEqual(t.genres.map((g) => [g.key, g.weight]), [["Sci-Fi", 1], ["Romance", -1]]);
  assert.deepEqual(t.decades.map((d) => [d.key, d.weight]), [[1990, 1], [2010, -1]]);
  assert.deepEqual(t.people, [{ key: 525, name: "Christopher Nolan", weight: 1, count: 1 }]);
});

test("a like and a dislike of the same trait cancel out", () => {
  const t = buildTaste([
    { reaction: "like", genres: ["Drama"], year: 2001, people: [] },
    { reaction: "dislike", genres: ["Drama"], year: 2005, people: [] },
  ]);
  assert.deepEqual(t.genres, []);
  assert.deepEqual(t.decades, []);
});

test("a title's weight is split across its genres", () => {
  const t = buildTaste([{ reaction: "like", genres: ["Action", "Thriller", "Action"], year: undefined, people: [] }]);
  assert.deepEqual(t.genres.map((g) => [g.key, g.weight]), [["Action", 0.5], ["Thriller", 0.5]]);
  assert.deepEqual(t.decades, []);
});

test("repeated likes rank a trait above one-offs", () => {
  const t = buildTaste([
    { reaction: "like", genres: ["Horror"], people: [] },
    { reaction: "like", genres: ["Horror"], people: [] },
    { reaction: "like", genres: ["Comedy"], people: [] },
  ]);
  assert.equal(t.genres[0].key, "Horror");
  assert.equal(t.genres[0].count, 2);
});

test("decades round down", () => {
  assert.equal(decadeOf(1980), 1980);
  assert.equal(decadeOf(1989), 1980);
  assert.equal(decadeOf(2024), 2020);
});

test("lists are capped", () => {
  const titles = Array.from({ length: 30 }, (_, i) => ({
    reaction: "like" as const,
    genres: [`g${i}`],
    people: [{ id: i, name: `p${i}` }],
  }));
  const t = buildTaste(titles);
  assert.equal(t.genres.length, 12);
  assert.equal(t.people.length, 12);
});
