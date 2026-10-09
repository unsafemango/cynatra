"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Kind, Title } from "./api";

/** What the shortlist keeps per title: enough to show it; details load after the pick. */
export type ShortlistItem = {
  id: string; // "movie:123"
  mediaType: "movie" | "tv";
  kind: Kind;
  title: string;
  year?: number;
  posterUrl?: string;
};

export const SHORTLIST_MAX = 5;
const KEY = "cynatra:shortlist";

export type AddResult = "added" | "exists" | "full";

type ShortlistState = {
  items: ShortlistItem[];
  /** False until the saved shortlist has been read from this browser. */
  loaded: boolean;
  add: (t: ShortlistItem) => AddResult;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};

const ShortlistContext = createContext<ShortlistState | null>(null);

export const toShortlistItem = (t: Title | ShortlistItem): ShortlistItem => ({
  id: t.id,
  mediaType: t.mediaType,
  kind: t.kind,
  title: t.title,
  year: t.year,
  posterUrl: t.posterUrl,
});

function read(): ShortlistItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, SHORTLIST_MAX) : [];
  } catch {
    return [];
  }
}

function write(items: ShortlistItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable (private mode): the shortlist lasts for this visit only.
  }
}

/** Up to five titles to choose between, kept in this browser (no account needed). */
export function ShortlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Read after mount so server and client HTML match.
    /* eslint-disable react-hooks/set-state-in-effect */
    setItems(read());
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Keep other open tabs in step.
    const onStorage = (e: StorageEvent) => e.key === KEY && setItems(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((next: ShortlistItem[]) => {
    setItems(next);
    write(next);
  }, []);

  const value: ShortlistState = {
    items,
    loaded,
    add: (t) => {
      if (items.some((i) => i.id === t.id)) return "exists";
      if (items.length >= SHORTLIST_MAX) return "full";
      update([...items, toShortlistItem(t)]);
      return "added";
    },
    remove: (id) => update(items.filter((i) => i.id !== id)),
    clear: () => update([]),
    has: (id) => items.some((i) => i.id === id),
  };
  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
}

export function useShortlist() {
  const ctx = useContext(ShortlistContext);
  if (!ctx) throw new Error("useShortlist must be used inside <ShortlistProvider>");
  return ctx;
}
