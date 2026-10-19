"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { describeFilters } from "@/components/FilterPanel";
import { FiltersDrawer } from "@/components/FiltersDrawer";
import { actionBtn, TitleCard } from "@/components/TitleCard";
import { SpinLoader } from "@/components/SpinLoader";
import { StableLabel } from "@/components/StableLabel";
import { api, ApiError, fromSlug, type Filters, type Genre, type ProviderOption, type Title } from "@/lib/api";
import { DEFAULT_REGION, flag, guessRegion, regionName } from "@/lib/regions";
import { useAuth } from "@/lib/auth";
import { revealResult } from "@/lib/scroll";
import { localSeen } from "@/lib/library";

const FILTERS_KEY = "cynatra:filters";
// The last result in this tab, so it's still there after going to log in and back.
const LAST_SPIN_KEY = "cynatra:last-spin";
const SPIN_LABELS = ["🎲 Spin", "Spinning…", "🎲 Spin again"] as const;
const DEFAULT_FILTERS: Filters = { type: "any", genres: [], minRating: 6.5 };
// Make the reel visible long enough to feel like a spin, even on cache hits.
const MIN_SPIN_MS = 900;

type Source = "filters" | "watchlist";

export function SpinPage() {
  const { user, ready } = useAuth();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // The Filters panel (a draft of the filters until "Apply").
  const [showFilters, setShowFilters] = useState(false);
  // True once saved filters (if any) are in state; URL-triggered spins wait for it.
  const [filtersReady, setFiltersReady] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  // Streaming services in the viewer's country, and the ones they pay for.
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [myServices, setMyServices] = useState<string[]>([]);
  // Logged out: a guess from the browser's languages (set after mount).
  const [guessedRegion, setGuessedRegion] = useState(DEFAULT_REGION);
  const region = user?.region ?? guessedRegion;
  const [result, setResult] = useState<Title | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Where the current result came from, so Reroll stays in the same mode.
  const [source, setSource] = useState<Source>("filters");
  // The result came back from LAST_SPIN_KEY: its library status may be stale.
  const [restored, setRestored] = useState(false);
  // Titles shown this session per mode, so rerolls don't repeat.
  const shown = useRef<string[]>([]);
  const shownWatchlist = useRef<string[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  // Set by a spin: show the loader, then the result, once each has rendered
  // (scrolling before then lands on an empty, zero-height area).
  const revealPending = useRef(false);
  useEffect(() => {
    if (!revealPending.current) return;
    revealResult(resultRef.current);
    if (!loading) revealPending.current = false;
  }, [loading, result, error]);
  // Spin requested by the URL (?spin=1 or ?from=watchlist); runs once auth is known.
  const autoRun = useRef<Source | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FILTERS_KEY);
      // Restored after mount (not in useState) so server and client HTML match.
      if (stored) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(stored) });
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // ignore
    }
    setFiltersReady(true);
    const params = new URLSearchParams(location.search);
    if (params.get("from") === "watchlist") autoRun.current = "watchlist";
    else if (params.get("spin") === "1") autoRun.current = "filters";
    // e.g. the title someone was just looking at when they asked for something else
    const skip = params.get("skip");
    if (skip) shown.current.push(fromSlug(skip));
    if (location.search) history.replaceState(null, "", "/");
    if (!autoRun.current) {
      try {
        const last = JSON.parse(sessionStorage.getItem(LAST_SPIN_KEY) ?? "null");
        if (last?.title?.id) {
          const title: Title = { ...last.title, library: undefined };
          setResult(title);
          setSource(last.source === "watchlist" ? "watchlist" : "filters");
          setRestored(true);
          shown.current.push(title.id);
        }
      } catch {
        // ignore
      }
    }

    setGuessedRegion(guessRegion());
    api<Genre[]>("/api/genres")
      .then(setGenres)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api<ProviderOption[]>(`/api/providers?region=${region}`)
      .then((p) => !cancelled && setProviders(p))
      .catch(() => !cancelled && setProviders([]));
    if (user) {
      api<{ subscribed: { key: string }[] }>("/api/me/services/subscribed")
        .then((r) => !cancelled && setMyServices(r.subscribed.map((s) => s.key)))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [ready, region, user]);

  const chips = describeFilters(filters, DEFAULT_FILTERS, genres, providers);

  const updateFilters = (f: Filters) => {
    setFilters(f);
    shown.current = [];
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(f));
    } catch {
      // ignore
    }
  };

  /** Shared spin flow: reel animation, result or error, scroll into view. */
  const run = useCallback(async (from: Source, fetchTitle: () => Promise<Title>) => {
    setLoading(true);
    setError(null);
    revealPending.current = true;
    const started = Date.now();
    try {
      const t = await fetchTitle();
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_SPIN_MS - (Date.now() - started))));
      setResult(t);
      setSource(from);
      setRestored(false);
      try {
        sessionStorage.setItem(LAST_SPIN_KEY, JSON.stringify({ title: t, source: from }));
      } catch {
        // ignore
      }
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  const spin = useCallback(
    () =>
      run("filters", async () => {
        const excludeIds = [...shown.current.slice(-100), ...(user ? [] : localSeen().slice(-400))];
        const t = await api<Title>("/api/pick", {
          method: "POST",
          // The country streaming availability (and the service filter) is for.
          body: JSON.stringify({ ...filters, region, excludeIds }),
        });
        shown.current.push(t.id);
        return t;
      }),
    [run, filters, user, region],
  );

  const spinWatchlist = useCallback(
    () =>
      run("watchlist", async () => {
        const pick = () =>
          api<Title>("/api/me/watchlist/pick", {
            method: "POST",
            body: JSON.stringify({ excludeIds: shownWatchlist.current }),
          });
        let t: Title;
        try {
          t = await pick();
        } catch (e) {
          // Went through the whole list: start a new round, skipping only the current title.
          if (!(e instanceof ApiError && e.status === 404 && shownWatchlist.current.length > 0)) throw e;
          const last = shownWatchlist.current.at(-1);
          shownWatchlist.current = last ? [last] : [];
          t = await pick().catch((err) => {
            // Only one unseen title on the list: show it again rather than an error.
            if (err instanceof ApiError && err.status === 404 && last) {
              shownWatchlist.current = [];
              return pick();
            }
            throw err;
          });
        }
        shownWatchlist.current.push(t.id);
        return t;
      }),
    [run],
  );

  const reroll = source === "watchlist" ? spinWatchlist : spin;
  const rerollLabel = source === "watchlist" ? "Pick another" : "Spin again";

  useEffect(() => {
    if (!ready || !filtersReady || !autoRun.current) return;
    const from = autoRun.current;
    autoRun.current = null;
    if (from === "watchlist" && user) spinWatchlist();
    else spin();
  }, [ready, filtersReady, user, spin, spinWatchlist]);

  return (
    <div className="space-y-10">
      <section className="text-center pt-4 sm:pt-10">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Stop scrolling. <span className="text-accent">Start watching.</span>
        </h1>
        <p className="mt-3 text-muted">Hit Spin for one pick tonight, or set a few filters first.</p>
      </section>

      <section aria-label="Spin" className="mx-auto max-w-xl">
        <div className="flex gap-3">
          <button
            onClick={spin}
            disabled={loading}
            className="flex-1 px-6 py-4 rounded-2xl bg-accent text-white text-lg font-semibold shadow-lg shadow-accent/30 hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60"
          >
            <StableLabel
              current={loading ? "Spinning…" : result && source === "filters" ? "🎲 Spin again" : "🎲 Spin"}
              all={SPIN_LABELS}
            />
          </button>
          <button
            onClick={() => setShowFilters(true)}
            aria-haspopup="dialog"
            aria-label={`Filters${chips.length ? `, ${chips.length} active` : ""}`}
            className="relative inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 sm:px-6 font-medium hover:border-muted transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {chips.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 h-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white tabular-nums">
                {chips.length}
              </span>
            )}
          </button>
        </div>

        {/* What the next spin is limited to; tap × to drop one. A line is kept even
            before saved filters load, so the page doesn't move. */}
        <div className={`mt-4 min-h-8 ${filtersReady ? "" : "invisible"}`}>
          {chips.length === 0 ? (
            <p className="text-center text-sm text-muted">
              No filters yet: well-rated picks of anything.{" "}
              <button
                onClick={() => setShowFilters(true)}
                className="text-foreground underline-offset-4 hover:underline"
              >
                Add filters
              </button>
            </p>
          ) : (
            <ul className="flex flex-wrap justify-center gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.id}>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-1 pl-3 pr-1 text-sm">
                    {c.label}
                    <button
                      onClick={() => updateFilters(c.remove(filters))}
                      aria-label={`Remove filter: ${c.label}`}
                      className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
              <li>
                <button
                  onClick={() => updateFilters(DEFAULT_FILTERS)}
                  className="px-2 py-1 text-sm text-muted hover:text-foreground"
                >
                  Clear all
                </button>
              </li>
            </ul>
          )}
        </div>

        {user && (
          <p className="mt-3 text-center">
            <button
              onClick={spinWatchlist}
              disabled={loading}
              className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline disabled:opacity-60"
            >
              or pick from my watchlist
            </button>
          </p>
        )}
      </section>

      {showFilters && (
        <FiltersDrawer
          filters={filters}
          defaults={DEFAULT_FILTERS}
          genres={genres}
          providers={providers}
          myServices={myServices}
          regionLabel={`${flag(region)} ${regionName(region)}`}
          onApply={(f) => {
            updateFilters(f);
            setShowFilters(false);
          }}
          onClose={() => setShowFilters(false)}
        />
      )}

      <div ref={resultRef} className="scroll-mt-20">
        {loading && (
          <SpinLoader
            message={
              filters.look === "colorful" && source === "filters"
                ? "Looking for something bright & colourful…"
                : undefined
            }
          />
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-lg">😶 {error}</p>
          </div>
        )}
        {!loading && result && (
          <>
            {/* Right above the result, so another go is the obvious next step. */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-muted">
                {source === "watchlist" ? (
                  <>
                    🎲 Picked from{" "}
                    <Link href="/library" className="text-foreground hover:underline underline-offset-4">
                      your watchlist
                    </Link>
                  </>
                ) : (
                  "🎲 Tonight's pick"
                )}
              </p>
              <button onClick={reroll} className={rerollBtn} title="Not this one? Get another pick">
                ↻ {rerollLabel}
              </button>
            </div>
            <TitleCard
              key={result.id}
              title={result}
              // Spun from the watchlist, or already in the library: say so.
              initialStatus={result.library ?? (source === "watchlist" ? "watchlist" : undefined)}
              fetchStatus={restored}
              onSeen={reroll}
            />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted">
              <span>Not feeling it?</span>
              <button onClick={reroll} className={actionBtn}>
                ↻ {rerollLabel}
              </button>
              {source === "filters" && (
                <button onClick={() => setShowFilters(true)} className={actionBtn}>
                  Change filters
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const rerollBtn =
  "shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.98]";
