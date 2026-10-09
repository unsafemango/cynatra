"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FilterPanel } from "@/components/FilterPanel";
import { ResultCard } from "@/components/ResultCard";
import { SpinLoader } from "@/components/SpinLoader";
import { api, toSlug, type Filters, type Genre, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addToWatchlist, localSeen, markSeen } from "@/lib/library";

const FILTERS_KEY = "cynatra:filters";
const DEFAULT_FILTERS: Filters = { type: "any", genres: [], minRating: 6.5 };
// Make the reel visible long enough to feel like a spin, even on cache hits.
const MIN_SPIN_MS = 900;

export default function SpinPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // Remounts the filter panel once saved filters load, so its local UI state
  // (e.g. which year mode is open) starts from them instead of the defaults.
  const [restoredFilters, setRestoredFilters] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [result, setResult] = useState<Title | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Titles shown this session, so rerolls don't repeat.
  const shown = useRef<string[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FILTERS_KEY);
      // Restored after mount (not in useState) so server and client HTML match.
      if (stored) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(stored) });
        setRestoredFilters(true);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // ignore
    }
    api<Genre[]>("/api/genres")
      .then(setGenres)
      .catch((e) => setError(e.message));
  }, []);

  const updateFilters = (f: Filters) => {
    setFilters(f);
    shown.current = [];
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(f));
    } catch {
      // ignore
    }
  };

  const spin = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    setSaved(false);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const started = Date.now();
    try {
      const excludeIds = [...shown.current.slice(-100), ...(user ? [] : localSeen().slice(-400))];
      const t = await api<Title>("/api/pick", {
        method: "POST",
        body: JSON.stringify({ ...filters, excludeIds }),
      });
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_SPIN_MS - (Date.now() - started))));
      shown.current.push(t.id);
      setResult(t);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [filters, user]);

  const onSeen = async () => {
    if (!result) return;
    await markSeen(result.id, Boolean(user), true, result).catch(() => {});
    spin();
  };

  const onSave = async () => {
    if (!result) return;
    try {
      await addToWatchlist(result);
      setSaved(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't save.");
    }
  };

  const onShare = async () => {
    if (!result) return;
    const url = `${location.origin}/t/${toSlug(result.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: result.title, text: "Watch this tonight:", url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Link copied!");
      }
    } catch {
      // user cancelled share sheet
    }
  };

  return (
    <div className="space-y-10">
      <section className="text-center pt-4 sm:pt-8">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Stop scrolling. <span className="text-accent">Start watching.</span>
        </h1>
        <p className="mt-3 text-muted">Set a few filters, hit Spin, and get one pick for tonight.</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-7">
        <FilterPanel key={restoredFilters ? "restored" : "default"} filters={filters} genres={genres} onChange={updateFilters} />
        <div className="mt-7 flex justify-center">
          <button
            onClick={spin}
            disabled={loading}
            className="w-full sm:w-auto px-12 py-3.5 rounded-xl bg-accent text-white text-lg font-semibold shadow-lg shadow-accent/30 hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60"
          >
            {loading ? "Spinning…" : result ? "🎲 Spin again" : "🎲 Spin"}
          </button>
        </div>
      </section>

      <div ref={resultRef} className="scroll-mt-20">
        {loading && <SpinLoader />}
        {!loading && error && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-lg">😶 {error}</p>
          </div>
        )}
        {!loading && result && (
          <ResultCard
            key={result.id}
            title={result}
            actions={
              <>
                <button onClick={spin} className={secondaryBtn}>
                  ↻ Reroll
                </button>
                {user ? (
                  <button onClick={onSave} disabled={saved} className={secondaryBtn}>
                    {saved ? "✓ On watchlist" : "+ Watchlist"}
                  </button>
                ) : (
                  <Link href="/login" className={secondaryBtn}>
                    + Watchlist
                  </Link>
                )}
                <button onClick={onSeen} className={secondaryBtn} title="Never show this again">
                  Seen it
                </button>
                <button onClick={onShare} className={secondaryBtn}>
                  Share
                </button>
                {notice && <span className="self-center text-sm text-muted">{notice}</span>}
              </>
            }
          />
        )}
      </div>
    </div>
  );
}

const secondaryBtn =
  "px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm hover:border-muted disabled:opacity-60";
