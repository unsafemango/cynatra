"use client";

import { useState } from "react";
import type { Filters } from "@/lib/api";
import { Chip } from "./Chip";
import { RANGE_MIN, YearRangePicker } from "./YearRangePicker";
import { YearSinglePicker } from "./YearSinglePicker";

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
  // Decade the single-year grid opens on, carried over from a decade chip if one was picked.
  const [yearView, setYearView] = useState<number | undefined>(undefined);

  const choose = (m: Mode, r: Range = {}) => {
    setMode(m);
    onChange({ yearFrom: r.yearFrom, yearTo: r.yearTo });
  };

  const openYear = () => {
    setYearView(yearFrom);
    choose("year");
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
        <Chip active={mode === "year"} onClick={openYear}>
          Specific year
        </Chip>
        <Chip active={mode === "range"} onClick={openRange}>
          Custom range
        </Chip>
      </div>

      {mode === "year" && (
        <YearSinglePicker
          value={yearFrom !== undefined && yearFrom === yearTo ? yearFrom : undefined}
          max={currentYear()}
          initialDecade={yearView}
          onChange={(y) => onChange({ yearFrom: y, yearTo: y })}
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

// Only called while the year or range picker is open, which never happens during prerender
// (filters start empty), so the build doesn't see a request-time clock read.
const currentYear = () => new Date().getFullYear();

export function yearHint({ yearFrom, yearTo }: Range) {
  if (yearFrom && yearFrom === yearTo) return `${yearFrom} only`;
  if (yearFrom && yearTo) return `${yearFrom}–${yearTo}`;
  if (yearFrom) return `${yearFrom} and later`;
  if (yearTo) return `${yearTo} and earlier`;
  return "Any year";
}
