"use client";

import { RATING_SOURCES, useRatingSource, type RatingSource } from "@/lib/ratings";

/** Choose which rating the site shows (IMDb by default). */
export function RatingSourcePicker({ id, className = "" }: { id: string; className?: string }) {
  const [source, setSource] = useRatingSource();
  return (
    <select
      id={id}
      value={source}
      onChange={(e) => setSource(e.target.value as RatingSource)}
      className={`rounded-lg border border-border bg-surface px-2 py-1 text-foreground hover:border-muted focus:border-accent focus:outline-none ${className}`}
    >
      {RATING_SOURCES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
