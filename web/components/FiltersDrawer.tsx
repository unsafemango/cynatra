"use client";

import { useEffect, useRef, useState } from "react";
import type { Filters, Genre, ProviderOption } from "@/lib/api";
import { describeFilters, FilterPanel } from "./FilterPanel";

/**
 * Every spin filter in one panel over the page: a sheet from the bottom on
 * phones, a side panel on the right elsewhere. Changes are a draft until
 * "Apply filters"; × / Esc / a click outside closes without applying.
 */
export function FiltersDrawer({
  filters,
  defaults,
  genres,
  providers,
  myServices,
  regionLabel,
  onApply,
  onClose,
}: {
  filters: Filters;
  /** What Reset goes back to. */
  defaults: Filters;
  genres: Genre[];
  providers: ProviderOption[] | null;
  myServices: string[];
  regionLabel: string;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Filters>(filters);

  // Open as a modal (focus moves in and stays, Escape closes); stop the page scrolling behind it.
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
      if (d?.open) d.close();
    };
  }, []);

  const count = describeFilters(draft, genres, providers).length;
  const changed = JSON.stringify(draft) !== JSON.stringify(filters);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="filters-title"
      onCancel={(e) => {
        e.preventDefault(); // let React unmount it
        onClose();
      }}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(e) => e.target === dialog.current && onClose()}
      className="animate-sheet m-0 mt-auto flex h-[92dvh] max-h-none w-full max-w-none flex-col overflow-hidden rounded-t-3xl border border-border bg-background p-0 text-foreground shadow-2xl shadow-black/50 backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:ml-auto sm:mt-0 sm:h-dvh sm:max-w-md sm:rounded-none sm:rounded-l-3xl"
    >
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid size-9 place-items-center rounded-xl bg-accent text-white" aria-hidden>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="filters-title" className="text-lg font-semibold leading-tight">
            Filters
          </h2>
          <p className="text-xs text-muted">{count === 0 ? "Anything goes" : `${count} active`}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close filters without applying"
          className="grid size-9 place-items-center rounded-full text-xl text-muted hover:bg-surface-2 hover:text-foreground"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <FilterPanel
          filters={draft}
          genres={genres}
          providers={providers}
          myServices={myServices}
          regionLabel={regionLabel}
          onChange={setDraft}
        />
      </div>

      <footer className="grid grid-cols-2 gap-3 border-t border-border bg-surface/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => setDraft(defaults)}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium hover:border-muted"
        >
          Reset
        </button>
        <button
          onClick={() => onApply(draft)}
          className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 hover:brightness-110"
        >
          {changed ? "Apply filters" : "Done"}
        </button>
      </footer>
    </dialog>
  );
}
