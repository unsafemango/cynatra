"use client";

import { useEffect, useRef, useState } from "react";
import { RANGE_MIN, YearInput } from "./YearRangePicker";

type Props = {
  value: number | undefined;
  max: number; // current year
  /** Decade to show first when nothing is selected yet (e.g. carried over from "90s"). */
  initialDecade?: number;
  onChange: (year: number) => void;
};

const decadeOf = (y: number) => Math.floor(y / 10) * 10;

function relative(year: number, max: number) {
  const diff = max - year;
  if (diff === 0) return "This year";
  if (diff === 1) return "Last year";
  return `${diff} years ago`;
}

/** Single-year picker: big editable year with steppers, a decade-by-decade grid, and quick picks. */
export function YearSinglePicker({ value, max, initialDecade, onChange }: Props) {
  const [decade, setDecade] = useState(() => decadeOf(value ?? initialDecade ?? max));
  const decades = Array.from({ length: (decadeOf(max) - RANGE_MIN) / 10 + 1 }, (_, i) => RANGE_MIN + i * 10);
  const decadeBar = useRef<HTMLDivElement>(null);

  // Keep the active decade tab centered in the scrollable strip (phones).
  // Scrolls only the strip, never the page.
  useEffect(() => {
    const bar = decadeBar.current;
    const el = bar?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (bar && el) bar.scrollTo({ left: el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [decade]);

  const select = (y: number) => {
    const clamped = Math.min(max, Math.max(RANGE_MIN, y));
    setDecade(decadeOf(clamped));
    onChange(clamped);
  };
  // With nothing chosen yet, either arrow starts at the newest year.
  const step = (delta: number) => select(value === undefined ? max : value + delta);

  const quick = [
    { label: "This year", year: max },
    { label: "Last year", year: max - 1 },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 sm:gap-2">
          <StepButton label="Previous year" disabled={value !== undefined && value <= RANGE_MIN} onClick={() => step(-1)}>
            ‹
          </StepButton>
          <YearInput
            label="Release year"
            value={value}
            min={RANGE_MIN}
            max={max}
            placeholder="Year"
            onCommit={select}
          />
          <StepButton label="Next year" disabled={value !== undefined && value >= max} onClick={() => step(1)}>
            ›
          </StepButton>
        </div>
        <span className="text-xs text-muted text-right">
          {value === undefined ? "Type a year or pick one below" : relative(value, max)}
        </span>
      </div>

      {/* Decade tabs */}
      <div
        ref={decadeBar}
        role="tablist"
        aria-label="Decade"
        className="relative mt-4 -mx-1 px-3 flex gap-1 overflow-x-auto scrollbar-none fade-x sm:mask-none sm:px-1"
      >
        {decades.map((d) => {
          const active = d === decade;
          const holdsValue = value !== undefined && decadeOf(value) === d;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDecade(d)}
              className={`relative shrink-0 px-2.5 py-1 rounded-md text-xs tabular-nums transition-colors ${
                active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {d}s
              {holdsValue && !active && (
                <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {/* Years in the chosen decade */}
      <div role="tabpanel" className="mt-3 grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => decade + i).map((y) => {
          const selected = y === value;
          const future = y > max;
          return (
            <button
              key={y}
              type="button"
              disabled={future || y < RANGE_MIN}
              aria-pressed={selected}
              onClick={() => select(y)}
              className={`relative py-2 rounded-lg text-sm tabular-nums border transition-all ${
                selected
                  ? "bg-accent border-accent text-white font-semibold shadow-md shadow-accent/30 scale-[1.04]"
                  : future
                    ? "border-transparent text-muted/30"
                    : "border-border text-muted hover:text-foreground hover:border-muted active:scale-95"
              }`}
            >
              {y}
              {y === max && !selected && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1 rounded bg-surface text-[9px] leading-3 text-accent-2">
                  now
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <QuickButton key={q.label} active={value === q.year} onClick={() => select(q.year)}>
            {q.label}
          </QuickButton>
        ))}
        <QuickButton active={false} onClick={() => select(randomYear(max, value))}>
          🎲 Random year
        </QuickButton>
      </div>
    </div>
  );
}

/** Random year weighted toward recent decades (where most well-rated titles are), never the current pick. */
function randomYear(max: number, current: number | undefined) {
  let y: number;
  do {
    y = max - Math.floor(Math.random() * Math.random() * (max - RANGE_MIN + 1));
  } while (y === current);
  return y;
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="size-8 grid place-items-center rounded-full text-xl leading-none text-muted border border-transparent
        hover:text-foreground hover:border-border hover:bg-surface-2 active:scale-90 transition-all disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function QuickButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
        active
          ? "border-accent text-accent bg-accent/10"
          : "border-border text-muted hover:text-foreground hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}
