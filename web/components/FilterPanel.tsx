"use client";

import { useState } from "react";
import type { Filters, Genre, PickType } from "@/lib/api";
import { Chip } from "./Chip";

const TYPES: { value: PickType; label: string }[] = [
  { value: "any", label: "🎲 Surprise me" },
  { value: "movie", label: "Movie" },
  { value: "series", label: "Series" },
  { value: "animation", label: "Animation" },
];

export const MOODS: { label: string; genres: string[] }[] = [
  { label: "☕ Cozy", genres: ["comedy", "family", "romance"] },
  { label: "👻 Scary", genres: ["horror", "thriller", "mystery"] },
  { label: "☀️ Feel-good", genres: ["comedy", "music", "adventure"] },
  { label: "🌀 Mind-bending", genres: ["scifi", "mystery", "thriller"] },
  { label: "⚡ Adrenaline", genres: ["action", "adventure", "thriller"] },
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
  onChange,
}: {
  filters: Filters;
  genres: Genre[];
  onChange: (f: Filters) => void;
}) {
  const [showMore, setShowMore] = useState(
    Boolean(filters.yearFrom || filters.yearTo || filters.maxRuntime || filters.language),
  );
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggleGenre = (slug: string) =>
    set({
      genres: filters.genres.includes(slug) ? filters.genres.filter((g) => g !== slug) : [...filters.genres, slug],
    });
  const num = (v: string) => (v ? Number(v) : undefined);

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
            const active = sameSet(filters.genres, m.genres);
            return (
              <Chip key={m.label} active={active} onClick={() => set({ genres: active ? [] : m.genres })}>
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
          {genres.map((g) => (
            <Chip key={g.slug} active={filters.genres.includes(g.slug)} onClick={() => toggleGenre(g.slug)}>
              {g.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Minimum rating" hint={filters.minRating ? `${filters.minRating.toFixed(1)}+ ★` : "Any rating"}>
        <input
          type="range"
          min={0}
          max={9}
          step={0.5}
          value={filters.minRating}
          onChange={(e) => set({ minRating: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
          aria-label="Minimum rating"
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>Any</span>
          <span>5</span>
          <span>7</span>
          <span>9</span>
        </div>
      </Section>

      <div>
        <button
          className="text-sm text-muted hover:text-foreground"
          onClick={() => setShowMore((s) => !s)}
          aria-expanded={showMore}
        >
          {showMore ? "▾" : "▸"} More filters
        </button>
        {showMore && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="From year">
              <input
                type="number"
                min={1900}
                max={2100}
                placeholder="Any"
                value={filters.yearFrom ?? ""}
                onChange={(e) => set({ yearFrom: num(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="To year">
              <input
                type="number"
                min={1900}
                max={2100}
                placeholder="Any"
                value={filters.yearTo ?? ""}
                onChange={(e) => set({ yearTo: num(e.target.value) })}
                className={inputCls}
              />
            </Field>
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
