"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Rating } from "@/components/Rating";
import { api, ApiError, formatRuntime, toSlug, type Title } from "@/lib/api";
import { startWatching } from "@/lib/library";

type State =
  | { kind: "picking" }
  | { kind: "picked"; title: Title; last?: boolean }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

const SHUFFLE_MS = 1100; // at least this long, so the shuffle reads as a shuffle

/**
 * "Pick one for me" from the watchlist, right on the Library page: a quick
 * poster shuffle that lands on a random unseen title, with Start watching,
 * Pick another and Open title page. Honours the Library's service filter.
 */
export function WatchlistPickDialog({
  posters,
  service,
  onClose,
  onLibraryChange,
}: {
  /** Watchlist posters to shuffle through while picking. */
  posters: string[];
  /** The Library's streaming-service filter, if one is on. */
  service: { key: string; name: string } | null;
  onClose: () => void;
  /** Something moved (e.g. to Watching): the Library should reload. */
  onLibraryChange: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ kind: "picking" });
  const [reelIndex, setReelIndex] = useState(0);
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState(false);
  // Titles shown this time, so "Pick another" goes through the whole list before repeating.
  const shown = useRef<string[]>([]);
  // Each pick gets a number; a slower, older pick (e.g. a double click) is ignored.
  const latestPick = useRef(0);

  // Open as a modal (focus moves in, Escape closes); stop the page scrolling behind it.
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
      if (d?.open) d.close();
    };
  }, []);

  const pick = useCallback(async () => {
    const id = ++latestPick.current;
    setState({ kind: "picking" });
    setMoved(false);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = Date.now();

    // Flick through the posters, slowing down, while the pick comes back.
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduceMotion && posters.length > 1) {
      let at = 0;
      for (let i = 1; i <= 14; i++) {
        at += 45 + i * 6;
        timers.push(setTimeout(() => setReelIndex((n) => n + 1), at));
      }
    }

    const query = service ? `?service=${encodeURIComponent(service.key)}` : "";
    const request = (excludeIds: string[]) =>
      api<Title>(`/api/me/watchlist/pick${query}`, { method: "POST", body: JSON.stringify({ excludeIds }) });

    // One request; a 404 (nothing left to pick) comes back as `none` instead of throwing.
    const attempt = async (excludeIds: string[]): Promise<{ title: Title } | { none: string }> => {
      try {
        return { title: await request(excludeIds) };
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return { none: e.message };
        throw e;
      }
    };

    let next: State;
    try {
      let result = await attempt(shown.current);
      let last = false;
      if ("none" in result && shown.current.length > 0) {
        // Been through them all: start a new round, skipping only the one on screen.
        shown.current = [shown.current.at(-1)!];
        result = await attempt(shown.current);
        if ("none" in result) {
          // Only one title to pick from: it's this one.
          shown.current = [];
          result = await attempt([]);
          last = true;
        }
      }
      if (id !== latestPick.current) return; // a newer pick took over
      if ("title" in result) {
        shown.current.push(result.title.id);
        next = { kind: "picked", title: result.title, last };
      } else {
        next = { kind: "empty", message: result.none };
      }
    } catch (e) {
      next = { kind: "error", message: e instanceof Error ? e.message : "Couldn't pick one." };
    }

    const wait = reduceMotion ? 0 : Math.max(0, SHUFFLE_MS - (Date.now() - started));
    setTimeout(() => {
      timers.forEach(clearTimeout);
      if (id === latestPick.current) setState(next);
    }, wait);
  }, [posters.length, service]);

  // Pick as soon as it opens, once (React may run effects twice in development).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void pick();
  }, [pick]);

  const watchNow = async (title: Title) => {
    setMoving(true);
    try {
      await startWatching(title);
      setMoved(true);
      onLibraryChange();
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setMoving(false);
    }
  };

  const reelPoster = posters.length ? posters[reelIndex % posters.length] : undefined;
  const picked = state.kind === "picked" ? state.title : null;
  const runtime = picked ? formatRuntime(picked) : null;

  return (
    <dialog
      ref={dialog}
      aria-label="Pick from your watchlist"
      aria-busy={state.kind === "picking"}
      onCancel={(e) => {
        e.preventDefault(); // let React unmount it
        onClose();
      }}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="relative p-5 sm:p-7">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full border border-border bg-surface/90 text-lg text-muted hover:border-muted hover:text-foreground"
        >
          ×
        </button>

        <p className="text-sm text-muted">
          🎲 {state.kind === "picking" ? "Picking" : "Picked"} from your watchlist
          {service && <> · on {service.name}</>}
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-[180px_1fr]">
          {/* Poster: shuffles while picking, then lands on the pick. */}
          <div className="relative mx-auto aspect-[2/3] w-40 overflow-hidden rounded-xl bg-surface-2 shadow-xl shadow-black/50 sm:w-full">
            {state.kind === "picking" && reelPoster && (
              <Image key={reelIndex} src={reelPoster} alt="" fill sizes="180px" className="object-cover opacity-80" />
            )}
            {picked?.posterUrl && (
              <Image
                key={picked.id}
                src={picked.posterUrl}
                alt={`${picked.title} poster`}
                fill
                sizes="180px"
                className="animate-pop object-cover"
              />
            )}
            {(state.kind === "empty" || state.kind === "error") && (
              <span className="absolute inset-0 grid place-items-center text-4xl" aria-hidden>
                🍿
              </span>
            )}
          </div>

          <div className="min-w-0" aria-live="polite">
            {state.kind === "picking" && (
              <div className="space-y-3 pt-1" aria-hidden>
                <div className="h-7 w-3/4 rounded bg-surface-2 animate-pulse" />
                <div className="h-4 w-1/3 rounded bg-surface-2 animate-pulse" />
                <div className="h-16 w-full rounded bg-surface-2 animate-pulse" />
              </div>
            )}

            {picked && (
              <div className="animate-pop">
                <h2 className="text-2xl font-semibold tracking-tight">{picked.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {[picked.year, runtime, picked.genres.slice(0, 3).join(" · ")].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2">
                  <Rating title={picked} />
                </div>
                <p className="mt-3 line-clamp-4 text-[15px] leading-relaxed text-foreground/90">
                  {picked.overview || "No summary available."}
                </p>
                {state.kind === "picked" && state.last && (
                  <p className="mt-2 text-sm text-muted">It&apos;s the only one left to pick from.</p>
                )}
              </div>
            )}

            {(state.kind === "empty" || state.kind === "error") && (
              <div className="pt-2">
                <p className="text-lg font-medium">
                  {state.kind === "empty" ? "Nothing to pick" : "Something went wrong"}
                </p>
                <p className="mt-1 text-muted">{state.message}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {picked && (
            <>
              <button
                onClick={() => watchNow(picked)}
                disabled={moving || moved}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-70"
              >
                {moved ? "✓ Moved to Watching" : "▶ Start watching"}
              </button>
              <button onClick={pick} className={secondaryBtn}>
                ↻ Pick another
              </button>
              <Link href={`/t/${toSlug(picked.id)}`} onClick={onClose} className={secondaryBtn}>
                Open title page
              </Link>
            </>
          )}
          {state.kind === "error" && (
            <button onClick={pick} className={secondaryBtn}>
              Try again
            </button>
          )}
          <button onClick={onClose} className={`${secondaryBtn} ml-auto`}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}

const secondaryBtn =
  "px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm hover:border-muted disabled:opacity-60";
