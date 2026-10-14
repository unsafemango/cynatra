"use client";

import { useState } from "react";
import type { Filters, Genre, PickType, ProviderOption } from "@/lib/api";
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

const RUNTIMES = [
  [0, "Any length"],
  [90, "Under 1h 30m"],
  [120, "Under 2 hours"],
  [150, "Under 2h 30m"],
] as const;

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
  const hiddenActive = [filters.look === "colorful", Boolean(filters.maxRuntime), Boolean(filters.language)].filter(
    Boolean,
  ).length;
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
        <input
          type="range"
          min={0}
          max={9}
          step={0.5}
          value={filters.minRating}
          onChange={(e) => set({ minRating: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
          aria-label="Minimum IMDb rating"
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>Any</span>
          <span>5</span>
          <span>7</span>
          <span>9</span>
        </div>
      </Section>

      <Section label="Streaming on" hint={servicesHint(filters.services ?? [], providers, regionLabel)}>
        <StreamingFilter
          options={providers}
          selected={filters.services ?? []}
          onChange={(services) => set({ services })}
          myServices={myServices}
        />
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
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <Field label="Length">
                <select
                  value={filters.maxRuntime ?? 0}
                  onChange={(e) => set({ maxRuntime: Number(e.target.value) || undefined })}
                  className={inputCls}
                >
                  {RUNTIMES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Language">
                <select
                  value={filters.language ?? ""}
                  onChange={(e) => set({ language: e.target.value || undefined })}
                  className={inputCls}
                >
                  {LANGUAGES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-muted";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}

/** "Any service in 🇨🇦 Canada", "Netflix or Crave", "4 services". */
function servicesHint(keys: string[], providers: ProviderOption[] | null, regionLabel: string) {
  if (keys.length === 0) return `Any service in ${regionLabel}`;
  const names = keys.map((k) => providers?.find((p) => p.key === k)?.name ?? k);
  return names.length <= 2 ? names.join(" or ") : `${names.length} services`;
}
