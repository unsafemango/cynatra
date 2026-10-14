"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Chip } from "@/components/Chip";
import { api, toSlug, type Appearance, type Person } from "@/lib/api";

type Credit = Person["credits"][number];
type Kind = "all" | "movie" | "tv";
type Sort = "popular" | "newest" | "az";

const SORT_LABEL: Record<Sort, string> = { popular: "Most popular", newest: "Newest", az: "A–Z" };
const byTitle = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

const FIRST = 10; // rows shown at first
const MORE = 20; // rows added per "Show more"

/** A person's movies and series: the best known first, a few at a time. */
export function Filmography({ credits }: { credits: Credit[] }) {
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<Sort>("popular");
  const [limit, setLimit] = useState(FIRST);
  const section = useRef<HTMLElement>(null);

  const counts = {
    all: credits.length,
    movie: credits.filter((c) => c.mediaType === "movie").length,
    tv: credits.filter((c) => c.mediaType === "tv").length,
  };
  const filtered = kind === "all" ? credits : credits.filter((c) => c.mediaType === kind);
  // Credits arrive newest first (upcoming ones leading); the other sorts reorder a copy.
  const sorted =
    sort === "popular"
      ? [...filtered].sort((a, b) => b.votes - a.votes)
      : sort === "az"
        ? [...filtered].sort((a, b) => byTitle.compare(a.title, b.title))
        : filtered;
  const shown = sorted.slice(0, limit);
  const hidden = sorted.length - shown.length;

  // Changing the view starts again from the top few.
  const choose = (next: { kind?: Kind; sort?: Sort }) => {
    if (next.kind) setKind(next.kind);
    if (next.sort) setSort(next.sort);
    setLimit(FIRST);
  };

  return (
    <section
      ref={section}
      aria-labelledby="filmography"
      className="scroll-mt-20 rounded-2xl border border-border bg-surface p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="filmography" className="text-lg font-semibold">
          Filmography <span className="text-sm font-normal text-muted">({credits.length})</span>
        </h2>
        <div
          className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-sm"
          role="group"
          aria-label="Sort by"
        >
          {(["popular", "newest", "az"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => choose({ sort: s })}
              className={`rounded-md px-3 py-1 transition-colors ${
                sort === s ? "bg-surface text-foreground shadow" : "text-muted hover:text-foreground"
              }`}
            >
              {SORT_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {counts.movie > 0 && counts.tv > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          <Chip active={kind === "all"} onClick={() => choose({ kind: "all" })}>
            All {counts.all}
          </Chip>
          <Chip active={kind === "movie"} onClick={() => choose({ kind: "movie" })}>
            Movies {counts.movie}
          </Chip>
          <Chip active={kind === "tv"} onClick={() => choose({ kind: "tv" })}>
            Series {counts.tv}
          </Chip>
        </div>
      )}

      <ul className="divide-y divide-border">
        {shown.map((c, i) => {
          // Newest: the year heads its group instead of repeating on every row.
          const year = c.year ? String(c.year) : "Soon";
          const prevYear = i > 0 ? (shown[i - 1].year ? String(shown[i - 1].year) : "Soon") : null;
          const showYear = sort !== "newest" || year !== prevYear;
          return (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <span className="w-11 shrink-0 text-sm tabular-nums text-muted" aria-hidden={!showYear}>
                {showYear ? year : ""}
              </span>
              <div className="relative h-15 w-10 shrink-0 overflow-hidden rounded-md bg-surface-2">
                {c.posterUrl && <Image src={c.posterUrl} alt="" fill sizes="40px" className="object-cover" />}
              </div>
              <div className="min-w-0">
                <Link
                  href={`/t/${toSlug(c.id)}`}
                  className="font-medium hover:underline decoration-accent underline-offset-4"
                >
                  {c.title}
                </Link>
                <p className="truncate text-xs text-muted">{describe(c)}</p>
                {c.creditIds && c.creditIds.length > 0 && <EpisodeLine creditIds={c.creditIds} />}
              </div>
            </li>
          );
        })}
      </ul>

      {(hidden > 0 || limit > FIRST) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          {hidden > 0 && (
            <>
              <button type="button" onClick={() => setLimit((l) => l + MORE)} className={moreBtn}>
                Show {Math.min(MORE, hidden)} more
              </button>
              {hidden > MORE && (
                <button type="button" onClick={() => setLimit(sorted.length)} className={moreBtn}>
                  Show all {sorted.length}
                </button>
              )}
            </>
          )}
          {limit > FIRST && (
            <button
              type="button"
              onClick={() => {
                setLimit(FIRST);
                section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="px-3 py-1.5 text-muted hover:text-foreground"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// One request per series row, shared across re-renders, sorting and "Show more".
const appearances = new Map<string, Promise<Appearance | null>>();

function loadAppearance(creditIds: string[]) {
  const key = creditIds.slice(0, 5).join(",");
  let p = appearances.get(key);
  if (!p) {
    p = api<Appearance>(`/api/episodes?credits=${key}`).catch(() => null);
    appearances.set(key, p);
  }
  return p;
}

/** Which episodes or seasons, e.g. "S36 E1 · Bart's Birthday" or "Seasons 1–3". */
function EpisodeLine({ creditIds }: { creditIds: string[] }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadAppearance(creditIds).then((a) => live && setText(a && describeAppearance(a)));
    return () => {
      live = false;
    };
  }, [creditIds]);
  // The line is there from the start (empty until loaded), so the row doesn't grow.
  return <p className="min-h-4 truncate text-xs text-muted/80">{text ?? ""}</p>;
}

const MAX_LISTED_EPISODES = 3;

function describeAppearance({ episodes, seasons }: Appearance): string | null {
  const code = (e: Appearance["episodes"][number]) => `S${e.season} E${e.number}`;
  if (episodes.length === 1) {
    const e = episodes[0];
    return e.name ? `${code(e)} · ${e.name}` : code(e);
  }
  if (episodes.length > 1 && episodes.length <= MAX_LISTED_EPISODES) return episodes.map(code).join(", ");
  return seasons.length > 0 ? seasonRanges(seasons) : null;
}

/** [1, 2, 3, 5] → "Seasons 1–3, 5"; [4] → "Season 4". */
function seasonRanges(seasons: number[]) {
  const parts: string[] = [];
  for (let i = 0; i < seasons.length; i++) {
    const start = seasons[i];
    while (seasons[i + 1] === seasons[i] + 1) i++;
    parts.push(start === seasons[i] ? `${start}` : `${start}–${seasons[i]}`);
  }
  return `${seasons.length === 1 ? "Season" : "Seasons"} ${parts.join(", ")}`;
}

/** "Series — Neo · Producer — 12 episodes" */
function describe(c: Credit) {
  return [
    c.mediaType === "tv" ? "Series" : null,
    c.roles.join(" · ") || null,
    c.episodes ? `${c.episodes} episode${c.episodes === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

const moreBtn = "rounded-lg border border-border bg-surface-2 px-4 py-1.5 hover:border-muted";
