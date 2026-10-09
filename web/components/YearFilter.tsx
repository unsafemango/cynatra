"use client";

import { useState } from "react";
import type { Filters } from "@/lib/api";
import { Chip } from "./Chip";
import { RANGE_MIN, YearRangePicker } from "./YearRangePicker";

type Range = { yearFrom?: number; yearTo?: number };
type Mode = "any" | "decade" | "year" | "range";

const DECADES: { label: string; from?: number; to: number }[] = [
  { label: "2020s", from: 2020, to: 2029 },
  { label: "2010s", from: 2010, to: 2019 },
  { label: "2000s", from: 2000, to: 2009 },
  { label: "90s", from: 1990, to: 1999 },
  { label: "80s", from: 1980, to: 1989 },
  { label: "Classics", to: 1979 },
];

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

// Only send complete 4-digit years; "19" while typing would be rejected by the API.
const parseYear = (v: string) => {
  const n = Number(v);
  return /^\d{4}$/.test(v) && n >= MIN_YEAR && n <= MAX_YEAR ? n : undefined;
};

function detectMode({ yearFrom, yearTo }: Range): Mode {
  if (!yearFrom && !yearTo) return "any";
  if (yearFrom && yearFrom === yearTo) return "year";
  if (DECADES.some((d) => d.from === yearFrom && d.to === yearTo)) return "decade";
  return "range";
}

export function YearFilter({ filters, onChange }: { filters: Filters; onChange: (r: Range) => void }) {
  const { yearFrom, yearTo } = filters;
  // Kept locally so "Specific year" / "Custom range" stay open before a year is typed.
  const [mode, setMode] = useState<Mode>(() => detectMode(filters));
  const [text, setText] = useState({ from: yearFrom?.toString() ?? "", to: yearTo?.toString() ?? "" });

  const choose = (m: Mode, r: Range = {}) => {
    setMode(m);
    setText({ from: r.yearFrom?.toString() ?? "", to: r.yearTo?.toString() ?? "" });
    onChange({ yearFrom: r.yearFrom, yearTo: r.yearTo });
  };

  const onYear = (v: string) => {
    setText({ from: v, to: v });
    const y = parseYear(v);
    onChange({ yearFrom: y, yearTo: y });
  };

  const openRange = () => {
    const max = new Date().getFullYear();
    // Carry over whatever is selected (e.g. a decade) so the slider starts there.
    const from = Math.max(RANGE_MIN, Math.min(yearFrom ?? 2000, max));
    const to = Math.max(from, Math.min(yearTo ?? max, max));
    choose("range", { yearFrom: from, yearTo: to });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Chip active={mode === "any"} onClick={() => choose("any")}>
          Any year
        </Chip>
        {DECADES.map((d) => (
          <Chip
            key={d.label}
            active={mode === "decade" && yearFrom === d.from && yearTo === d.to}
            onClick={() => choose("decade", { yearFrom: d.from, yearTo: d.to })}
          >
            {d.label}
          </Chip>
        ))}
        <Chip active={mode === "year"} onClick={() => choose("year")}>
          Specific year
        </Chip>
        <Chip active={mode === "range"} onClick={openRange}>
          Custom range
        </Chip>
      </div>

      {mode === "year" && (
        <input
          type="number"
          inputMode="numeric"
          min={MIN_YEAR}
          max={MAX_YEAR}
          placeholder="e.g. 1999"
          aria-label="Release year"
          autoFocus
          value={text.from}
          onChange={(e) => onYear(e.target.value)}
          className={`${inputCls} w-40`}
        />
      )}

      {mode === "range" && (
        <YearRangePicker
          from={yearFrom ?? RANGE_MIN}
          to={yearTo ?? currentYear()}
          max={Math.max(currentYear(), yearTo ?? 0)}
          onChange={(from, to) => onChange({ yearFrom: from, yearTo: to })}
        />
      )}
    </div>
  );
}

// Only called while the range picker is open, which never happens during prerender
// (filters start empty), so the build doesn't see a request-time clock read.
const currentYear = () => new Date().getFullYear();

export function yearHint({ yearFrom, yearTo }: Range) {
  if (yearFrom && yearFrom === yearTo) return `${yearFrom} only`;
  if (yearFrom && yearTo) return `${yearFrom}–${yearTo}`;
  if (yearFrom) return `${yearFrom} and later`;
  if (yearTo) return `${yearTo} and earlier`;
  return "Any year";
}

const inputCls =
  "bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-muted";
