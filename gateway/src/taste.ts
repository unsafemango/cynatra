import type { Pool, PoolClient } from "pg";
import type { Reaction } from "./reactions.js";

// What a user's likes and dislikes say about their taste: a signed weight per
// genre, decade and person. Positive means they lean toward it, negative away.

type Db = Pool | PoolClient;

export type Person = { id: number; name: string };

/** A rated title, reduced to the traits we score. */
export type RatedTitle = {
  reaction: Reaction;
  genres: string[];
  year?: number;
  people: Person[];
};

export type Weighted<K> = { key: K; weight: number; count: number };
export type WeightedPerson = Weighted<number> & { name: string };

export type TasteProfile = {
  /** How many rated titles the profile is built from. */
  ratings: number;
  genres: Weighted<string>[];
  decades: Weighted<number>[];
  people: WeightedPerson[];
};

const MAX_PER_KIND = 12;
const SIGN: Record<Reaction, number> = { like: 1, dislike: -1 };

/** 1987 -> 1980. */
export const decadeOf = (year: number) => Math.floor(year / 10) * 10;

function rank<K>(m: Map<K, { weight: number; count: number }>): Weighted<K>[] {
  return [...m.entries()]
    .map(([key, v]) => ({ key, weight: round(v.weight), count: v.count }))
    .filter((w) => w.weight !== 0)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight) || b.count - a.count)
    .slice(0, MAX_PER_KIND);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Builds a profile from rated titles. Each rating adds ±1 to every trait of
 * the title, split across its traits of that kind so a title with six genres
 * doesn't outweigh one with two. Likes and dislikes of the same trait cancel.
 */
export function buildTaste(titles: RatedTitle[]): TasteProfile {
  const genres = new Map<string, { weight: number; count: number }>();
  const decades = new Map<number, { weight: number; count: number }>();
  const people = new Map<number, { weight: number; count: number; name: string }>();

  const add = <K>(m: Map<K, { weight: number; count: number }>, key: K, w: number) => {
    const cur = m.get(key) ?? { weight: 0, count: 0 };
    cur.weight += w;
    cur.count += 1;
    m.set(key, cur);
  };

  for (const t of titles) {
    const sign = SIGN[t.reaction];
    const g = [...new Set(t.genres)];
    for (const name of g) add(genres, name, sign / g.length);
    if (t.year) add(decades, decadeOf(t.year), sign);
    const p = [...new Map(t.people.map((x) => [x.id, x])).values()];
    for (const person of p) {
      add(people, person.id, sign / p.length);
      people.get(person.id)!.name = person.name;
    }
  }

  return {
    ratings: titles.length,
    genres: rank(genres),
    decades: rank(decades),
    people: rank(people).map((w) => ({ ...w, name: people.get(w.key)!.name })),
  };
}

type Row = { reaction: Reaction; title: { genres?: unknown; year?: unknown } | null; people: Person[] | null };

/** Every title the user has rated, as the traits we score. */
export async function loadRatedTitles(db: Db, userId: string): Promise<RatedTitle[]> {
  const { rows } = await db.query<Row>(
    "SELECT reaction, title, people FROM seen WHERE user_id = $1 AND reaction IS NOT NULL ORDER BY reacted_at DESC",
    [userId],
  );
  return rows.map((r) => ({
    reaction: r.reaction,
    genres: Array.isArray(r.title?.genres) ? r.title.genres.filter((g): g is string => typeof g === "string") : [],
    year: typeof r.title?.year === "number" ? r.title.year : undefined,
    people: r.people ?? [],
  }));
}

export async function loadTaste(db: Db, userId: string): Promise<TasteProfile> {
  return buildTaste(await loadRatedTitles(db, userId));
}

/** The profile to send with a spin, or undefined when there's nothing to go on. */
export async function tasteForPick(db: Db, userId: string): Promise<TasteProfile | undefined> {
  const taste = await loadTaste(db, userId);
  return taste.genres.length + taste.decades.length + taste.people.length > 0 ? taste : undefined;
}

/**
 * Starts the taste profile over: clears every like and dislike, and the people
 * saved for them. The titles stay on the Seen list. Returns how many ratings
 * were cleared.
 */
export async function resetTaste(db: Db, userId: string): Promise<number> {
  const { rowCount } = await db.query(
    "UPDATE seen SET reaction = NULL, reacted_at = NULL, people = NULL WHERE user_id = $1 AND reaction IS NOT NULL",
    [userId],
  );
  return rowCount ?? 0;
}

/**
 * Rated titles whose cast hasn't been saved yet (rated before people were
 * tracked, or while the picker was down), newest first.
 */
export async function ratedWithoutPeople(db: Db, userId: string, limit = 10): Promise<string[]> {
  const { rows } = await db.query<{ title_id: string }>(
    "SELECT title_id FROM seen WHERE user_id = $1 AND reaction IS NOT NULL AND people IS NULL ORDER BY reacted_at DESC LIMIT $2",
    [userId, limit],
  );
  return rows.map((r) => r.title_id);
}
