"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ClearButton } from "@/components/ClearButton";
import { PosterTile } from "@/components/PosterTile";
import { SearchIcon, Spinner } from "@/components/icons";
import { api, type SearchHit } from "@/lib/api";

/** Find any movie or series by name; each result opens its title page. */
export function SearchView() {
  const params = useSearchParams();
  // Starts from ?q= so a search survives Back from a title page and can be shared.
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [results, setResults] = useState<{ q: string; hits: SearchHit[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = query.trim();
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    setQuery("");
    setResults(null);
    setError(null);
    input.current?.focus();
  };

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      history.replaceState(null, "", q ? `/search?q=${encodeURIComponent(q)}` : "/search");
      if (q.length < 2) return;
      setSearching(true);
      api<SearchHit[]>(`/api/search?q=${encodeURIComponent(q)}&limit=20`)
        .then((hits) => !cancelled && (setResults({ q, hits }), setError(null)))
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Search failed."))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const shown = q.length >= 2 ? results : null;

  return (
    <div className="space-y-8">
      <section aria-label="Search" className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-center text-2xl font-semibold tracking-tight">Find a movie or series</h1>
        <label htmlFor="title-search" className="sr-only">
          Movie or series name
        </label>
        <div className="relative">
          {/* The magnifier turns into a spinner while searching. */}
          {searching ? (
            <Spinner className="animate-spin pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          ) : (
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          )}
          <input
            ref={input}
            id="title-search"
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                clear();
              }
              // Phones: Search on the keyboard puts it away, to show the results.
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="e.g. Paddington, The Bear, Spirited Away"
            autoComplete="off"
            autoFocus
            className="w-full rounded-2xl border border-border bg-surface py-3.5 pl-11 pr-11 placeholder:text-muted/60 hover:border-muted/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
          {query && <ClearButton onClear={clear} />}
        </div>
        {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      </section>

      {!shown && !searching && (
        <p className="text-center text-sm text-muted">
          Type at least two letters. Pick a result to see everything about it.
        </p>
      )}

      {shown && (
        <section aria-live="polite" aria-label="Results" className={searching ? "opacity-60 transition-opacity" : ""}>
          {shown.hits.length === 0 ? (
            <p className="text-center text-muted">No movies or series match “{shown.q}”.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-5">
              {shown.hits.map((hit) => (
                <li key={hit.id}>
                  <PosterTile hit={hit} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
