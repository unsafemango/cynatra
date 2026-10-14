"use client";

import { useState } from "react";
import type { Filters, Genre, PickType, ProviderOption } from "@/lib/api";
import { Select, type SelectOption } from "./Select";
import { StreamingFilter } from "./StreamingFilter";
import { Chip } from "./Chip";
import { YearFilter, yearHint } from "./YearFilter";

const TYPES: { value: PickType; label: string }[] = [
  { value: "any", label: "🎲 Surprise me" },
  { value: "movie", label: "Movie" },
  { value: "series", label: "Series" },
  { value: "animation", label: "Animation" },
];

// Same labels as the picker's genre list; only used to size the loading placeholders.
const GENRE_PLACEHOLDERS = [
  "Action",
  "Adventure",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

export const MOODS: { label: string; genres: string[]; look?: Filters["look"] }[] = [
  { label: "☕ Cozy", genres: ["comedy", "family", "romance"] },
  { label: "👻 Scary", genres: ["horror", "thriller", "mystery"] },
  { label: "☀️ Feel-good", genres: ["comedy", "music", "adventure"] },
  { label: "🌀 Mind-bending", genres: ["scifi", "mystery", "thriller"] },
  { label: "⚡ Adrenaline", genres: ["action", "adventure", "thriller"] },
  // Genres plus the Look filter, so it's colourful by what's on screen, not just by genre.
  { label: "🦄 Colourful fun", genres: ["comedy", "family", "fantasy", "music", "adventure"], look: "colorful" },
];

const LANGUAGES = [
  ["", "Any language"],
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["hi", "Hindi"],
  ["zh", "Chinese"],
] as const;

const RUNTIME_HINTS: Record<number, string> = {
  0: "No limit",
  90: "A quick one",
  120: "A regular evening",
  150: "Room for an epic",
};

const LANGUAGE_NATIVE: Record<string, string> = {
  "": "Original language doesn't matter",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  hi: "हिन्दी",
  zh: "中文",
};

const RUNTIMES = [
  [0, "Any length"],
  [90, "Under 1h 30m"],
  [120, "Under 2 hours"],
  [150, "Under 2h 30m"],
] as const;

const RUNTIME_OPTIONS: SelectOption<string>[] = RUNTIMES.map(([minutes, label]) => ({
  value: String(minutes),
  label,
  description: RUNTIME_HINTS[minutes],
}));

const LANGUAGE_OPTIONS: SelectOption<string>[] = LANGUAGES.map(([code, label]) => ({
  value: code,
  label,
  // The language's own name, unless it's the same as the English one.
  description: LANGUAGE_NATIVE[code] !== label ? LANGUAGE_NATIVE[code] : undefined,
}));

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function FilterPanel({
  filters,
  genres,
  providers,
  myServices,
  regionLabel,
  onChange,
}: {
  filters: Filters;
  genres: Genre[];
  /** Streaming services in the viewer's country (null while loading). */
  providers: ProviderOption[] | null;
  /** Services the user pays for (from the Services page). */
  myServices: string[];
  /** e.g. "🇨🇦 Canada": where the streaming filter applies. */
  regionLabel: string;
  onChange: (f: Filters) => void;
}) {
  // Filters tucked under "More filters"; the toggle shows how many are on so a
  // vibe that turns one on (e.g. Colourful fun → Look) is never invisible.
  const hiddenActive = [
    filters.look === "colorful",
    Boolean(filters.maxRuntime),
    Boolean(filters.language),
    (filters.services?.length ?? 0) > 0,
  ].filter(Boolean).length;
  const [showMore, setShowMore] = useState(hiddenActive > 0);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggleGenre = (slug: string) =>
    set({
      genres: filters.genres.includes(slug) ? filters.genres.filter((g) => g !== slug) : [...filters.genres, slug],
    });

  return (
    <div className="space-y-6">
      <Section label="What are you in the mood for?">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Chip key={t.value} active={filters.type === t.value} onClick={() => set({ type: t.value })}>
              {t.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Vibe" hint="Shortcut for a set of genres">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => {
            const active = sameSet(filters.genres, m.genres) && (!m.look || filters.look === m.look);
            const toggle = () =>
              m.look
                ? set(active ? { genres: [], look: "any" } : { genres: m.genres, look: m.look })
                : set({ genres: active ? [] : m.genres });
            return (
              <Chip key={m.label} active={active} onClick={toggle}>
                {m.label}
              </Chip>
            );
          })}
        </div>
      </Section>

      <Section
        label="Genres"
        hint={filters.genres.length ? `${filters.genres.length} selected · any of them` : "Any genre"}
        action={
          filters.genres.length > 0 && (
            <button className="text-xs text-muted hover:text-foreground" onClick={() => set({ genres: [] })}>
              Clear
            </button>
          )
        }
      >
        <div className="flex flex-wrap gap-2">
          {/* Placeholders the size of the real chips until the list arrives, so nothing below moves. */}
          {genres.length === 0 &&
            GENRE_PLACEHOLDERS.map((label) => (
              <span
                key={label}
                aria-hidden
                className="px-3.5 py-1.5 rounded-full text-sm border border-border bg-surface text-transparent animate-pulse"
              >
                {label}
              </span>
            ))}
          {genres.map((g) => (
            <Chip key={g.slug} active={filters.genres.includes(g.slug)} onClick={() => toggleGenre(g.slug)}>
              {g.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Release year" hint={yearHint(filters)}>
        <YearFilter filters={filters} onChange={set} />
      </Section>

      <Section
        label="Minimum IMDb rating"
        hint={filters.minRating ? `${filters.minRating.toFixed(1)}+ on IMDb` : "Any rating"}
      >
        <RatingSlider value={filters.minRating} onChange={(minRating) => set({ minRating })} />
      </Section>

      <div>
        <button
          className="text-sm text-muted hover:text-foreground"
          onClick={() => setShowMore((s) => !s)}
          aria-expanded={showMore}
        >
          {showMore ? "▾" : "▸"} More filters
          {hiddenActive > 0 && <span className="text-accent"> · {hiddenActive} on</span>}
        </button>
        {showMore && (
          <div className="mt-4 space-y-5">
            <div>
              <p className="text-xs text-muted mb-1.5">
                Streaming on · {servicesHint(filters.services ?? [], providers, regionLabel)}
              </p>
              <StreamingFilter
                options={providers}
                selected={filters.services ?? []}
                onChange={(services) => set({ services })}
                myServices={myServices}
              />
            </div>
            <div>
              <p className="text-xs text-muted mb-1.5">
                Look ·{" "}
                {filters.look === "colorful"
                  ? "vivid colours and bright scenes, judged from each title's images"
                  : "any"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip active={filters.look !== "colorful"} onClick={() => set({ look: "any" })}>
                  Any look
                </Chip>
                <Chip active={filters.look === "colorful"} onClick={() => set({ look: "colorful" })}>
                  🦄 Bright &amp; colourful
                </Chip>
              </div>
            </div>
            <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
              <Field label="Length" id="filter-length">
                <Select
                  aria-labelledby="filter-length"
                  value={String(filters.maxRuntime ?? 0)}
                  onChange={(v) => set({ maxRuntime: Number(v) || undefined })}
                  options={RUNTIME_OPTIONS}
                />
              </Field>
              <Field label="Language" id="filter-language">
                <Select
                  aria-labelledby="filter-language"
                  value={filters.language ?? ""}
                  onChange={(v) => set({ language: v || undefined })}
                  options={LANGUAGE_OPTIONS}
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function Section({
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2.5 gap-3">
        <h2 className="text-sm font-medium">
          {label} {hint && <span className="text-muted font-normal">· {hint}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// Not a <label>: a click inside an open Select list would re-toggle its button.
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <span id={id} className="block text-xs text-muted mb-1">
        {label}
      </span>
      {children}
    </div>
  );
}

/** "Any service in 🇨🇦 Canada", "Netflix or Crave", "4 services". */
function servicesHint(keys: string[], providers: ProviderOption[] | null, regionLabel: string) {
  if (keys.length === 0) return `Any service in ${regionLabel}`;
  const names = keys.map((k) => providers?.find((p) => p.key === k)?.name ?? k);
  return names.length <= 2 ? names.join(" or ") : `${names.length} services`;
}

const RATING_MAX = 9;
const THUMB = 18; // px, matches .rating-range in globals.css
const RATING_TICKS = [0, 5, 6, 7, 8, 9];

/** Where a value sits along the slider, as a CSS length (the thumb's centre never reaches the very edges). */
const ratingPosition = (v: number) => {
  const p = v / RATING_MAX;
  return `calc(${p * 100}% + ${(0.5 - p) * THUMB}px)`;
};

/** Minimum IMDb rating, 0 ("Any") to 9 in half steps, with labels exactly under their values. */
function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <input
        type="range"
        min={0}
        max={RATING_MAX}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Minimum IMDb rating"
        aria-valuetext={value ? `${value.toFixed(1)} or higher on IMDb` : "Any rating"}
        className="rating-range"
        style={{ "--fill": ratingPosition(value) } as React.CSSProperties}
      />
      <div className="relative mt-1.5 h-4 text-xs text-muted" aria-hidden>
        {RATING_TICKS.map((t) => (
          <span
            key={t}
            className={`absolute top-0 -translate-x-1/2 tabular-nums ${value === t ? "text-foreground" : ""}`}
            style={{ left: ratingPosition(t) }}
          >
            {t === 0 ? "Any" : t}
          </span>
        ))}
      </div>
    </div>
  );
}
