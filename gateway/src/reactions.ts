import type { Pool, PoolClient } from "pg";

// A thumbs up or down on a title the user has seen.

type Db = Pool | PoolClient;

export const REACTIONS = ["like", "dislike"] as const;
export type Reaction = (typeof REACTIONS)[number];

/**
 * Sets (or, with null, clears) the reaction on a seen title. Returns false
 * when the title isn't in the user's Seen list: only seen titles can be rated.
 */
export async function setReaction(db: Db, userId: string, titleId: string, reaction: Reaction | null) {
  const { rowCount } = await db.query(
    `UPDATE seen
        SET reaction = $3::text, reacted_at = CASE WHEN $3::text IS NULL THEN NULL ELSE now() END
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
