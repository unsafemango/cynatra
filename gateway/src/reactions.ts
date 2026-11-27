import type { Pool, PoolClient } from "pg";
import { callPicker } from "./picker.js";
import type { Person } from "./taste.js";

// A thumbs up or down on a title the user has seen.

type Db = Pool | PoolClient;

export const REACTIONS = ["like", "dislike"] as const;
export type Reaction = (typeof REACTIONS)[number];

/**
 * Sets (or, with null, clears) the reaction on a seen title. Returns false
 * when the title isn't in the user's Seen list: only seen titles can be rated.
 * Clearing also drops the saved people, which are only kept for rated titles.
 */
export async function setReaction(db: Db, userId: string, titleId: string, reaction: Reaction | null) {
  const { rowCount } = await db.query(
    `UPDATE seen
        SET reaction = $3::text,
            reacted_at = CASE WHEN $3::text IS NULL THEN NULL ELSE now() END,
            people = CASE WHEN $3::text IS NULL THEN NULL ELSE people END
      WHERE user_id = $1 AND title_id = $2`,
    [userId, titleId, reaction],
  );
  return rowCount === 1;
}

/** The user's reaction to one title, or null if they haven't rated it. */
export async function getReaction(db: Db, userId: string, titleId: string): Promise<Reaction | null> {
  const { rows } = await db.query<{ reaction: Reaction | null }>(
    "SELECT reaction FROM seen WHERE user_id = $1 AND title_id = $2",
    [userId, titleId],
  );
  return rows[0]?.reaction ?? null;
}

const CAST_LIMIT = 5;

/** The people worth scoring on a full title: its creators, directors and top-billed cast. */
export function leadPeople(full: {
  createdBy?: Person[];
  cast?: { id: number; name: string }[];
  crew?: { job: string; people: Person[] }[];
}): Person[] {
  const directors = (full.crew ?? []).filter((c) => c.job === "Director").flatMap((c) => c.people);
  const leads = [...(full.createdBy ?? []), ...directors];
  const cast = (full.cast ?? []).slice(0, CAST_LIMIT);
  return [...new Map([...leads, ...cast].map((p) => [p.id, { id: p.id, name: p.name }])).values()];
}

/**
 * Saves who's in a rated title. Best effort: the picker may be down, and the
 * rating is already saved, so a failure just leaves people out of the profile.
 */
export async function savePeople(db: Db, userId: string, titleId: string, region: string) {
  const [media, id] = titleId.split(":");
  try {
    const { rows } = await db.query("SELECT people IS NOT NULL AS has FROM seen WHERE user_id = $1 AND title_id = $2", [
      userId,
      titleId,
    ]);
    if (rows.length === 0 || rows[0].has) return;
    const { status, body } = await callPicker(`/title/${media}/${id}/full?region=${region}`);
    if (status !== 200) return;
    const people = leadPeople(body.details ?? {});
    // The rating may have been cleared while the picker was answering.
    await db.query("UPDATE seen SET people = $3 WHERE user_id = $1 AND title_id = $2 AND reaction IS NOT NULL", [
      userId,
      titleId,
      JSON.stringify(people),
    ]);
  } catch {
    // Keep the rating without people.
  }
}
