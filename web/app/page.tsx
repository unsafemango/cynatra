"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FilterPanel } from "@/components/FilterPanel";
import { actionBtn, TitleCard } from "@/components/TitleCard";
import { SpinLoader } from "@/components/SpinLoader";
import { StableLabel } from "@/components/StableLabel";
import { api, ApiError, fromSlug, type Filters, type Genre, type ProviderOption, type Title } from "@/lib/api";
import { flag, guessRegion, regionName } from "@/lib/regions";
import { useAuth } from "@/lib/auth";
import { localSeen } from "@/lib/library";

const FILTERS_KEY = "cynatra:filters";
const SPIN_LABELS = ["🎲 Spin", "Spinning…", "🎲 Spin again"] as const;
const DEFAULT_FILTERS: Filters = { type: "any", genres: [], minRating: 6.5 };
// Make the reel visible long enough to feel like a spin, even on cache hits.
const MIN_SPIN_MS = 900;

type Source = "filters" | "watchlist";

export default function SpinPage() {
  const { user, ready } = useAuth();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // Remounts the filter panel once saved filters load, so its local UI state
  // (e.g. which year mode is open) starts from them instead of the defaults.
  const [restoredFilters, setRestoredFilters] = useState(false);
  // True once saved filters (if any) are in state; URL-triggered spins wait for it.
  const [filtersReady, setFiltersReady] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  // Streaming services in the viewer's country, and the ones they pay for.
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [myServices, setMyServices] = useState<string[]>([]);
  // Logged out: a guess from the browser's languages (set after mount).
  const [guessedRegion, setGuessedRegion] = useState("US");
  const region = user?.region ?? guessedRegion;
  const [result, setResult] = useState<Title | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Where the current result came from, so Reroll stays in the same mode.
  const [source, setSource] = useState<Source>("filters");
  // Titles shown this session per mode, so rerolls don't repeat.
  const shown = useRef<string[]>([]);
  const shownWatchlist = useRef<string[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  // Spin requested by the URL (?spin=1 or ?from=watchlist); runs once auth is known.
  const autoRun = useRef<Source | null>(null);

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
    setFiltersReady(true);
    const params = new URLSearchParams(location.search);
    if (params.get("from") === "watchlist") autoRun.current = "watchlist";
    else if (params.get("spin") === "1") autoRun.current = "filters";
    // e.g. the title someone was just looking at when they asked for something else
    const skip = params.get("skip");
    if (skip) shown.current.push(fromSlug(skip));
    if (location.search) history.replaceState(null, "", "/");

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
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const started = Date.now();
    try {
      const t = await fetchTitle();
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_SPIN_MS - (Date.now() - started))));
      setResult(t);
      setSource(from);
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

  useEffect(() => {
    if (!ready || !filtersReady || !autoRun.current) return;
    const from = autoRun.current;
    autoRun.current = null;
    if (from === "watchlist" && user) spinWatchlist();
    else spin();
  }, [ready, filtersReady, user, spin, spinWatchlist]);

  return (
    <div className="space-y-10">
      <section className="text-center pt-4 sm:pt-8">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Stop scrolling. <span className="text-accent">Start watching.</span>
        </h1>
        <p className="mt-3 text-muted">Set a few filters, hit Spin, and get one pick for tonight.</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-7">
        <FilterPanel
          key={restoredFilters ? "restored" : "default"}
          filters={filters}
          genres={genres}
          providers={providers}
          myServices={myServices}
          regionLabel={`${flag(region)} ${regionName(region)}`}
          onChange={updateFilters}
        />
        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            onClick={spin}
            disabled={loading}
            className="w-full sm:w-auto px-12 py-3.5 rounded-xl bg-accent text-white text-lg font-semibold shadow-lg shadow-accent/30 hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60"
          >
            <StableLabel
              current={loading ? "Spinning…" : result && source === "filters" ? "🎲 Spin again" : "🎲 Spin"}
              all={SPIN_LABELS}
            />
          </button>
          {user && (
            <button
              onClick={spinWatchlist}
              disabled={loading}
              className="text-sm text-muted hover:text-foreground underline-offset-4 hover:underline disabled:opacity-60"
            >
              or pick from my watchlist
            </button>
          )}
        </div>
      </section>

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
        {!loading && result && source === "watchlist" && (
          <p className="mb-3 text-sm text-muted">
            🎲 Picked from{" "}
            <Link href="/library" className="text-foreground hover:underline underline-offset-4">
              your watchlist
            </Link>
          </p>
        )}
        {!loading && result && (
          <TitleCard
            key={result.id}
            title={result}
            // Spun from the watchlist, or already in the library: say so.
            initialStatus={result.library ?? (source === "watchlist" ? "watchlist" : undefined)}
            before={
              <button onClick={reroll} className={actionBtn}>
                ↻ Reroll
              </button>
            }
            onSeen={reroll}
          />
        )}
      </div>
    </div>
  );
}
