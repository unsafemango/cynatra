"use client";

import { useRef, useState } from "react";

export const RANGE_MIN = 1920;

type Props = {
  from: number;
  to: number;
  max: number; // current year
  onChange: (from: number, to: number) => void;
};

// Thumb travel is inset by half the thumb width, so overlays use the same math.
const THUMB = 22;
const pos = (pct: number) => `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${pct})`;

/** Dual-thumb year slider with editable year readouts and quick presets. */
export function YearRangePicker({ from, to, max, onChange }: Props) {
  const span = max - RANGE_MIN;
  const pct = (y: number) => (y - RANGE_MIN) / span;
  const presets = [
    { label: "Last 5 years", from: max - 4, to: max },
    { label: "Last 10 years", from: max - 9, to: max },
    { label: "Last 25 years", from: max - 24, to: max },
    { label: "Before 2000", from: RANGE_MIN, to: 1999 },
  ];
  const ticks = [1920, 1950, 1980, 2000, max].filter((t, i, a) => a.indexOf(t) === i);
  const years = to - from + 1;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2 sm:gap-3">
          <YearInput
            label="From year"
            value={from}
            min={RANGE_MIN}
            max={to}
            onCommit={(y) => onChange(y, to)}
          />
          <span className="text-muted text-xl">–</span>
          <YearInput label="To year" value={to} min={from} max={max} onCommit={(y) => onChange(from, y)} />
        </div>
        <span className="text-xs text-muted pb-1.5 whitespace-nowrap">
          {years === 1 ? "1 year" : `${years} years`}
        </span>
      </div>

      <RangeTrack from={from} to={to} max={max} onChange={onChange} />

      <div className="relative h-4 mt-1 text-[11px] text-muted" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(pct(t)) }}>
            {t}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.from, p.to)}
              aria-pressed={active}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                active
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:text-foreground hover:border-muted"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Thumb = "from" | "to";

/**
 * Custom two-handle track. Pointer down grabs the nearest handle (or jumps it
 * there); when both handles share a year, the drag direction decides which
 * one moves, so they can always be pulled apart.
 */
function RangeTrack({ from, to, max, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ thumb: Thumb | null; startX: number } | null>(null);
  const [active, setActive] = useState<Thumb | null>(null);
  const span = max - RANGE_MIN;
  const pct = (y: number) => (y - RANGE_MIN) / span;

  const yearAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const usable = r.width - THUMB;
    const t = Math.min(1, Math.max(0, (clientX - r.left - THUMB / 2) / usable));
    return Math.round(RANGE_MIN + t * span);
  };

  const move = (thumb: Thumb, y: number) => {
    if (thumb === "from") onChange(Math.min(y, to), to);
    else onChange(from, Math.max(y, from));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const y = yearAt(e.clientX);
    const dFrom = Math.abs(y - from);
    const dTo = Math.abs(y - to);
    let thumb: Thumb | null = dFrom < dTo ? "from" : dTo < dFrom ? "to" : null;
    // Tie but outside the pair: the side tells us which handle is meant.
    if (thumb === null && y !== from) thumb = y < from ? "from" : "to";
    drag.current = { thumb, startX: e.clientX };
    if (thumb) {
      setActive(thumb);
      move(thumb, y);
      document.getElementById(`year-thumb-${thumb}`)?.focus({ preventScroll: true });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.thumb) {
      // Handles overlap: wait for a few pixels of movement to pick a direction.
      if (Math.abs(e.clientX - d.startX) < 3) return;
      d.thumb = e.clientX < d.startX ? "from" : "to";
      setActive(d.thumb);
      document.getElementById(`year-thumb-${d.thumb}`)?.focus({ preventScroll: true });
    }
    move(d.thumb, yearAt(e.clientX));
  };

  const endDrag = () => {
    drag.current = null;
    setActive(null);
  };

  const onKeyDown = (thumb: Thumb) => (e: React.KeyboardEvent) => {
    const value = thumb === "from" ? from : to;
    const big = e.shiftKey ? 10 : 1;
    const next: Record<string, number> = {
      ArrowLeft: value - big,
      ArrowDown: value - big,
      ArrowRight: value + big,
      ArrowUp: value + big,
      PageDown: value - 10,
      PageUp: value + 10,
      Home: thumb === "from" ? RANGE_MIN : from,
      End: thumb === "to" ? max : to,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    move(thumb, Math.min(max, Math.max(RANGE_MIN, next[e.key])));
  };

  const thumbEl = (thumb: Thumb, value: number) => (
    <div
      id={`year-thumb-${thumb}`}
      role="slider"
      tabIndex={0}
      aria-label={thumb === "from" ? "From year" : "To year"}
      aria-valuemin={thumb === "from" ? RANGE_MIN : from}
      aria-valuemax={thumb === "from" ? to : max}
      aria-valuenow={value}
      onKeyDown={onKeyDown(thumb)}
      className={`absolute top-1/2 size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground
        border-4 border-accent shadow-[0_2px_8px_rgb(0_0_0/0.5)] transition-transform duration-100
        hover:scale-110 focus-visible:outline-none focus-visible:ring-[5px] focus-visible:ring-accent/35
        ${active === thumb ? "scale-[1.18] cursor-grabbing" : "cursor-grab"}`}
      style={{ left: pos(pct(value)), zIndex: active === thumb ? 3 : 2 }}
    >
      {active === thumb && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-1.5 py-0.5 rounded bg-foreground text-background text-[11px] font-semibold tabular-nums">
          {value}
        </span>
      )}
    </div>
  );

  return (
    <div
      ref={trackRef}
      className="relative h-7 mt-5 touch-none select-none cursor-pointer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-surface-2" />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gradient-to-r from-accent to-accent-2"
        style={{ left: pos(pct(from)), right: `calc(100% - ${pos(pct(to))})` }}
      />
      {thumbEl("from", from)}
      {thumbEl("to", to)}
    </div>
  );
}

/** Large year readout you can click and type into; commits on Enter or blur. */
function YearInput({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (y: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    // Out-of-range years are clamped; anything unparseable reverts.
    if (/^\d{4}$/.test(draft)) onCommit(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={4}
      aria-label={label}
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const next = Math.min(max, Math.max(min, value + (e.key === "ArrowUp" ? 1 : -1)));
          setDraft(String(next));
          onCommit(next);
        }
      }}
      className="w-[4.5ch] bg-transparent text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight rounded-md
        border-b-2 border-dashed border-border hover:border-muted focus:border-accent focus:outline-none
        transition-colors"
    />
  );
}
