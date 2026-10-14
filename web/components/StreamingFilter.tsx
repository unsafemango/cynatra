"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProviderOption } from "@/lib/api";

const TOP = 10; // services shown before "Show all"

/**
 * Pick the streaming services to spin from: logo chips for the main services
 * in the viewer's country, "My services" (the ones they pay for), and the full
 * list with a search box.
 */
export function StreamingFilter({
  options,
  selected,
  onChange,
  myServices,
}: {
  /** null while loading. */
  options: ProviderOption[] | null;
  selected: string[];
  onChange: (keys: string[]) => void;
  /** Keys of the services the user ticked on the Services page. */
  myServices: string[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

  if (!options) {
    // Placeholders the size of the real chips, so nothing moves when they arrive.
    return (
      <div className="flex flex-wrap gap-2" aria-hidden>
        {Array.from({ length: TOP }, (_, i) => (
          <span key={i} className="h-[34px] w-28 rounded-full border border-border bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  // Top services, plus anything selected from further down the list.
  const q = query.trim().toLowerCase();
  const shown = showAll
    ? options.filter((o) => !q || o.name.toLowerCase().includes(q))
    : options.filter((o, i) => i < TOP || selected.includes(o.key));
  const mine = myServices.filter((k) => options.some((o) => o.key === k));
  const usingMine = mine.length > 0 && mine.length === selected.length && mine.every((k) => selected.includes(k));

  return (
    <div className="space-y-3">
      {showAll && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${options.length} services…`}
          aria-label="Search streaming services"
          className="w-full rounded-xl border border-border bg-background/60 px-3.5 py-2 text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none sm:max-w-xs"
        />
      )}
      <div className={`flex flex-wrap gap-2 ${showAll ? "max-h-64 overflow-y-auto pr-1" : ""}`}>
        {shown.map((o) => {
          const on = selected.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.key)}
              className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm transition-colors ${
                on
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border bg-surface text-muted hover:border-muted hover:text-foreground"
              }`}
            >
              {o.logo ? (
                <Image src={o.logo} alt="" width={24} height={24} className="rounded-full" />
              ) : (
                <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-xs" aria-hidden>
                  {o.name.charAt(0)}
                </span>
              )}
              {o.name}
              {on && (
                <span aria-hidden className="text-accent">
                  ✓
                </span>
              )}
            </button>
          );
        })}
        {showAll && shown.length === 0 && <p className="py-1 text-sm text-muted">No services match “{query}”.</p>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {mine.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(usingMine ? [] : mine)}
            aria-pressed={usingMine}
            className={usingMine ? "text-accent-2" : "text-muted hover:text-foreground"}
            title="The services you ticked on your Streaming services page"
          >
            ★ My services ({mine.length})
          </button>
        )}
        <button type="button" onClick={() => setShowAll((s) => !s)} className="text-muted hover:text-foreground">
          {showAll ? "Show fewer" : `Show all (${options.length})`}
        </button>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-muted hover:text-foreground">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
