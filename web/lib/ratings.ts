"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Title } from "./api";

/** Which score is shown across the site. IMDb unless the visitor picks TMDB. */
export type RatingSource = "imdb" | "tmdb";

export const RATING_SOURCES: { value: RatingSource; label: string }[] = [
  { value: "imdb", label: "IMDb" },
  { value: "tmdb", label: "TMDB" },
];

const KEY = "cynatra:rating";
const CHANGED = "cynatra:rating-changed"; // same-tab updates; "storage" covers other tabs

function read(): RatingSource {
  try {
    return localStorage.getItem(KEY) === "tmdb" ? "tmdb" : "imdb";
  } catch {
    return "imdb";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** The visitor's rating choice (kept in this browser) and a setter. */
export function useRatingSource() {
  const source = useSyncExternalStore(subscribe, read, () => "imdb" as const);
  const setSource = useCallback((s: RatingSource) => {
    try {
      localStorage.setItem(KEY, s);
    } catch {
      // Storage unavailable (private mode): the choice lasts until reload.
    }
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [source, setSource] as const;
}

export type ShownRating = { source: RatingSource; rating: number; votes: number; url?: string };

/** The score to show for a title: the chosen source, or TMDB's when IMDb has none. */
export function shownRating(t: Title, source: RatingSource): ShownRating {
  if (source === "imdb" && t.imdb) {
    return {
      source: "imdb",
      rating: t.imdb.rating,
      votes: t.imdb.votes,
      url: t.imdbId ? `https://www.imdb.com/title/${t.imdbId}/` : undefined,
    };
  }
  return { source: "tmdb", rating: t.rating, votes: t.voteCount, url: t.tmdbUrl };
}

/** 2284977 → "2.3M", 28926 → "29K". */
export const compactVotes = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
