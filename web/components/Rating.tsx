"use client";

import type { Title } from "@/lib/api";
import { compactVotes, shownRating, useRatingSource } from "@/lib/ratings";

/** The title's score from the visitor's chosen source, e.g. [IMDb] 8.7 · 2.3M votes. */
export function Rating({ title }: { title: Title }) {
  const [source] = useRatingSource();
  const r = shownRating(title, source);
  const label = r.source === "imdb" ? "IMDb" : "TMDB";
  const fallback = source === "imdb" && r.source === "tmdb";

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <a
        href={r.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md hover:opacity-90"
        title={`${label} rating${fallback ? " (IMDb has no rating for this yet)" : ""}`}
      >
        <SourceBadge source={r.source} />
        <span className="font-semibold text-foreground">{r.rating.toFixed(1)}</span>
        <span className="text-muted">/10</span>
      </a>
      <span className="text-muted">{compactVotes(r.votes)} votes</span>
    </span>
  );
}

export function SourceBadge({ source }: { source: "imdb" | "tmdb" }) {
  return source === "imdb" ? (
    <span className="rounded px-1.5 py-px text-[11px] font-black tracking-tight bg-[#f5c518] text-black">IMDb</span>
  ) : (
    <span className="rounded px-1.5 py-px text-[11px] font-bold tracking-tight bg-[#01b4e4] text-[#0d253f]">TMDB</span>
  );
}

/** Short text form for compact lists, e.g. "IMDb 8.7". */
export function useRatingText() {
  const [source] = useRatingSource();
  return (t: Title) => {
    const r = shownRating(t, source);
    return `${r.source === "imdb" ? "IMDb" : "TMDB"} ${r.rating.toFixed(1)}`;
  };
}
