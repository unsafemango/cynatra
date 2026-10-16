"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AddToShortlistButton } from "@/components/AddToShortlistButton";
import { Spinner } from "@/components/icons";
import { TitleCard } from "@/components/TitleCard";
import { TitleDetailsDialog } from "@/components/TitleDetailsDialog";
import { api, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SHORTLIST_MAX, useShortlist, type ShortlistItem } from "@/lib/shortlist";

type Mode = "instant" | "knockout";
type Phase = "idle" | "picking" | "done";

const KIND_LABEL = { movie: "Movie", series: "Series", animation: "Animation" } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ShortlistPage() {
  const { items, remove, clear, loaded } = useShortlist();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("instant");
  const [phase, setPhase] = useState<Phase>("idle");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [out, setOut] = useState<string[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [result, setResult] = useState<Title | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  // The shortlisted title whose details are open.
  const [detailsFor, setDetailsFor] = useState<ShortlistItem | null>(null);
  // Bumped to cancel a running pick (leaving the page, picking again).
  const run = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  // Stop any animation when this (kept-alive) page is hidden.
  useLayoutEffect(
    () => () => {
      run.current++;
      setPhase((p) => (p === "picking" ? "idle" : p));
      setHighlight(null);
      setDetailsFor(null);
    },
    [],
  );

  // The winner was removed from the shortlist: drop the result.
  const winner = items.find((i) => i.id === winnerId) ?? null;
  const showResult = phase === "done" && winner;

  const pick = async () => {
    if (items.length < 2 || phase === "picking") return;
    const id = ++run.current;
    const alive = () => run.current === id;
    const pool = [...items];
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    setPhase("picking");
    setOut([]);
    setWinnerId(null);
    setResult(null);
    setResultError(null);
    setAnnounce("Picking…");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && mode === "instant") {
      // Roulette: the highlight runs round the posters, slowing until it lands on the winner.
      const start = Math.floor(Math.random() * pool.length);
      const target = pool.indexOf(chosen);
      let steps = 3 * pool.length + ((target - start + pool.length) % pool.length);
      let delay = 60;
      for (let i = start; steps >= 0; i++, steps--) {
        setHighlight(pool[i % pool.length].id);
        await sleep(delay);
        if (!alive()) return;
        delay = Math.min(delay * 1.13, 420);
      }
    } else if (!reduceMotion) {
      // Knock-out: one random title goes every beat until one is left.
      const losers = pool.filter((t) => t !== chosen).sort(() => Math.random() - 0.5);
      await sleep(500);
      for (let i = 0; i < losers.length; i++) {
        if (!alive()) return;
        setOut(losers.slice(0, i + 1).map((t) => t.id));
        setAnnounce(`Out: ${losers[i].title}`);
        await sleep(900);
      }
    }
    if (!alive()) return;
    setHighlight(null);
    setOut(pool.filter((t) => t !== chosen).map((t) => t.id));
    setWinnerId(chosen.id);
    setPhase("done");
    setAnnounce(`Tonight's pick: ${chosen.title}`);

    // Full details (trailer, where to watch) for the result card.
    const [media, tmdbId] = chosen.id.split(":");
    try {
      const t = await api<Title>(`/api/title/${media}/${tmdbId}?region=${user?.region ?? "US"}`);
      if (alive()) setResult(t);
    } catch (e) {
      if (alive()) setResultError(e instanceof Error ? e.message : "Couldn't load the details.");
    }
  };

  // Bring the result into view once it's ready.
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const resetPick = () => {
    run.current++;
    setPhase("idle");
    setOut([]);
    setWinnerId(null);
    setHighlight(null);
    setResult(null);
  };

  const picking = phase === "picking";

  return (
    <div className="space-y-8">
      <header className="text-center pt-2 sm:pt-4">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Tonight&apos;s <span className="text-accent">shortlist</span>
        </h1>
        <p className="mt-2 text-muted">
          Torn between a few? Add up to {SHORTLIST_MAX}, then let Cynatra choose.
        </p>
      </header>

      <Search disabled={picking} />

      <section aria-labelledby="slots-title" className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 id="slots-title" className="text-lg font-semibold">
            Your shortlist{" "}
            <span className="text-sm font-normal text-muted tabular-nums">
              {items.length}/{SHORTLIST_MAX}
            </span>
          </h2>
          {items.length > 0 && !picking && (
            <button
              onClick={() => {
                resetPick();
                clear();
              }}
              className="text-sm text-muted hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>

        <ul className="mt-5 grid grid-cols-3 sm:grid-cols-5 gap-3">
          {Array.from({ length: SHORTLIST_MAX }, (_, i) => items[i]).map((item, i) =>
            item ? (
              <Slot
                key={item.id}
                item={item}
                state={
                  winnerId === item.id
                    ? "winner"
                    : out.includes(item.id)
                      ? "out"
                      : highlight === item.id
                        ? "highlight"
                        : "normal"
                }
                locked={picking}
                onOpen={() => setDetailsFor(item)}
                onRemove={() => {
                  if (winnerId === item.id) resetPick();
                  remove(item.id);
                }}
              />
            ) : (
              <li
                key={`empty-${i}`}
                className="aspect-[2/3] rounded-xl border-2 border-dashed border-border grid place-items-center text-center text-xs text-muted/70 p-2"
              >
                {loaded ? "Empty slot" : ""}
              </li>
            ),
          )}
        </ul>

        {/* Always one line here, so loading the saved shortlist doesn't move the buttons below. */}
        <p className={`mt-5 min-h-5 text-sm text-muted text-center ${loaded ? "" : "invisible"}`}>
          {items.length === 0 ? (
            <>
              Search above, or tap <span className="text-foreground">+ Shortlist</span> on a{" "}
              <Link href="/" className="underline underline-offset-4 hover:text-foreground">
                spin
              </Link>{" "}
              or in your{" "}
              <Link href="/library" className="underline underline-offset-4 hover:text-foreground">
                library
              </Link>
              .
            </>
          ) : (
            "Tap a title for details, or × to remove it."
          )}
        </p>

        <div className="mt-7 flex flex-col items-center gap-4">
          <div role="radiogroup" aria-label="How to pick" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/60 p-1 text-sm">
            {(
              [
                ["instant", "Instant pick"],
                ["knockout", "Knock them out one by one"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                disabled={picking}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-2 transition-colors ${
                  mode === m ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={pick}
            disabled={items.length < 2 || picking}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-12 py-3.5 rounded-xl bg-accent text-white text-lg font-semibold shadow-lg shadow-accent/30 hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50 disabled:shadow-none"
          >
            {picking ? (
              <>
                <Spinner /> Picking…
              </>
            ) : phase === "done" ? (
              "🎲 Pick again"
            ) : (
              "🎲 Pick for me"
            )}
          </button>
          {loaded && items.length === 1 && (
            <p className="text-sm text-muted">Add at least one more title to pick between.</p>
          )}
          <p aria-live="assertive" className="sr-only">
            {announce}
          </p>
          {mode === "knockout" && picking && out.length > 0 && (
            <p className="text-sm text-muted" aria-hidden>
              Out: <span className="text-foreground">{items.find((i) => i.id === out.at(-1))?.title}</span>
            </p>
          )}
        </div>
      </section>

      {detailsFor && (
        <TitleDetailsDialog
          item={detailsFor}
          onClose={() => setDetailsFor(null)}
          onRemove={() => {
            if (winnerId === detailsFor.id) resetPick();
            remove(detailsFor.id);
          }}
        />
      )}

      {showResult && (
        <div ref={resultRef} className="scroll-mt-20 space-y-3">
          <p className="text-center text-sm text-muted">🏆 Tonight&apos;s pick</p>
          {result ? (
            <TitleCard
              key={result.id}
              title={result}
              fetchStatus
              before={
                <button onClick={pick} className={secondaryBtn}>
                  ↻ Pick again
                </button>
              }
            />
          ) : resultError ? (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center">{resultError}</p>
          ) : (
            <div className="h-[360px] rounded-2xl border border-border bg-surface animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}

function Slot({
  item,
  state,
  locked,
  onOpen,
  onRemove,
}: {
  item: ShortlistItem;
  state: "normal" | "highlight" | "out" | "winner";
  locked: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={`relative transition-all duration-200 ${
        state === "highlight" ? "scale-105" : state === "winner" ? "scale-105" : state === "out" ? "scale-95" : ""
      }`}
    >
      {/* Poster and name both open the details. */}
      <button
        type="button"
        onClick={onOpen}
        disabled={locked}
        tabIndex={-1}
        aria-hidden
        className={`group/poster relative block w-full aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 ring-offset-2 ring-offset-surface transition-all enabled:cursor-pointer enabled:hover:brightness-110 ${
          state === "highlight"
            ? "ring-4 ring-accent"
            : state === "winner"
              ? "ring-4 ring-accent-2 shadow-xl shadow-accent-2/20"
              : ""
        } ${state === "out" ? "opacity-30 grayscale" : ""}`}
      >
        {item.posterUrl ? (
          <Image src={item.posterUrl} alt="" fill sizes="(max-width: 640px) 33vw, 180px" className="object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted">{item.title}</span>
        )}
        {state === "out" && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-12 bg-background/80 py-1 text-center text-xs font-bold tracking-widest text-accent">
            OUT
          </span>
        )}
        {state === "winner" && (
          <span className="absolute inset-x-0 bottom-0 bg-accent-2 py-1 text-center text-xs font-bold text-background">
            🏆 Winner
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        disabled={locked}
        title={`Details for ${item.title}`}
        className={`mt-1.5 block w-full truncate text-left text-xs underline-offset-4 decoration-border enabled:cursor-pointer enabled:hover:text-foreground enabled:hover:underline ${
          state === "out" ? "text-muted/60 line-through" : "text-muted"
        }`}
      >
        {item.title}
      </button>
      {!locked && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${item.title} from shortlist`}
          className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border border-border bg-surface text-muted shadow hover:text-foreground hover:border-muted"
        >
          ×
        </button>
      )}
    </li>
  );
}

/** Find a specific movie or series by name and add it. */
function Search({ disabled }: { disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShortlistItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setSearching(true);
      api<ShortlistItem[]>(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => !cancelled && (setResults(r), setError(null)))
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Search failed."))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const showResults = query.trim().length >= 2 && results;

  return (
    <section aria-label="Find a title" className="mx-auto max-w-2xl">
      <label htmlFor="shortlist-search" className="sr-only">
        Search for a movie or series
      </label>
      <div className="relative">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="shortlist-search"
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) setResults(null);
          }}
          placeholder="Search a movie or series to add…"
          autoComplete="off"
          className="w-full rounded-2xl border border-border bg-surface py-3.5 pl-11 pr-11 placeholder:text-muted/60 hover:border-muted/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60"
        />
        {searching && <Spinner className="animate-spin absolute right-4 top-1/2 -translate-y-1/2 text-muted" />}
      </div>

      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      {showResults && (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface divide-y divide-border" aria-live="polite">
          {results.length === 0 && <li className="p-4 text-sm text-muted">No movies or series match “{query.trim()}”.</li>}
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <div className="relative h-15 w-10 shrink-0 overflow-hidden rounded-md bg-surface-2">
                {r.posterUrl && <Image src={r.posterUrl} alt="" fill sizes="40px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-xs text-muted">{[r.year, KIND_LABEL[r.kind]].filter(Boolean).join(" · ")}</p>
              </div>
              <AddToShortlistButton
                title={r}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-foreground hover:border-muted disabled:opacity-50"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const secondaryBtn =
  "px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm hover:border-muted disabled:opacity-60";
