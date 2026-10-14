"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Shown before the label (a flag, emoji or badge). */
  icon?: ReactNode;
  /** A short second line under the label. */
  description?: string;
  /** Extra words the search matches, e.g. a country code. */
  keywords?: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Lets a <label htmlFor> name the field. */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Adds a search box at the top of the list (for long lists). */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** "sm" for compact places like the footer. */
  size?: "md" | "sm";
  /** Which edge the list lines up with when it's wider than the button. */
  align?: "start" | "end";
  className?: string;
};

const LIST_MAX_HEIGHT = 300; // px, matches max-h below

/**
 * A styled, accessible replacement for <select>: a button that opens a list of
 * options (listbox pattern). Keyboard: arrows, Home/End, Enter/Space, Esc,
 * and type-ahead (or the search box when `searchable`).
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  id,
  searchable = false,
  searchPlaceholder = "Search…",
  disabled = false,
  size = "md",
  align = "start",
  className = "",
  ...aria
}: Props<T>) {
  const autoId = useId();
  const buttonId = id ?? `${autoId}-button`;
  const listId = `${autoId}-list`;
  const optionId = (i: number) => `${autoId}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => `${o.label} ${o.keywords ?? ""} ${o.description ?? ""}`.toLowerCase().includes(q))
    : options;

  const openList = () => {
    if (disabled) return;
    // Open upward when there isn't room below (e.g. in the footer).
    const r = button.current?.getBoundingClientRect();
    if (r) setDropUp(window.innerHeight - r.bottom < LIST_MAX_HEIGHT + 16 && r.top > window.innerHeight - r.bottom);
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const choose = (o: SelectOption<T> | undefined) => {
    if (!o) return;
    if (o.value !== value) onChange(o.value);
    close();
  };

  // Focus the search box (or the list) on open.
  useLayoutEffect(() => {
    if (!open) return;
    (searchable ? search.current : list.current)?.focus();
  }, [open, searchable]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const last = shown.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => (a >= last ? 0 : a + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => (a <= 0 ? last : a - 1));
        return;
      case "Home":
        if (searchable) return; // let the search box move its caret
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        if (searchable) return;
        e.preventDefault();
        setActive(last);
        return;
      case "Enter":
        e.preventDefault();
        choose(shown[active]);
        return;
      case " ":
        if (searchable) return; // spaces belong in the search
        e.preventDefault();
        choose(shown[active]);
        return;
      case "Escape":
        e.preventDefault();
        close();
        return;
      case "Tab":
        close(false);
        return;
    }
    // Type-ahead: jump to the next option starting with what was typed.
    if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typed.current.text =
        now - typed.current.at > 700 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
      typed.current.at = now;
      const from = typed.current.text.length === 1 ? active + 1 : active;
      const order = [...shown.slice(from), ...shown.slice(0, from)];
      const hit = order.find((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit) setActive(shown.indexOf(hit));
    }
  };

  const sm = size === "sm";

  return (
    <div ref={root} className={`relative ${sm ? "inline-block" : "block"} ${className}`}>
      <button
        ref={button}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        {...aria}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            openList();
          }
        }}
        className={`group flex w-full items-center gap-2 border text-left transition-colors focus:outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 disabled:opacity-60 ${
          open ? "border-accent" : "border-border hover:border-muted/70"
        } ${
          sm
            ? "rounded-lg bg-surface px-2.5 py-1.5 text-xs text-foreground"
            : "rounded-xl bg-background/60 px-3.5 py-3 text-[15px]"
        }`}
      >
        {selected?.icon && <span className="flex shrink-0 items-center">{selected.icon}</span>}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? "Choose…"}</span>
        <svg
          width={sm ? 12 : 16}
          height={sm ? 12 : 16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className={`animate-pop absolute z-40 min-w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50 ${
            dropUp ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
          } ${align === "end" ? "right-0" : "left-0"} ${sm ? "w-64" : ""}`}
        >
          {searchable && (
            <div className="border-b border-border p-2">
              <input
                ref={search}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={shown.length ? optionId(active) : undefined}
                autoComplete="off"
                className="w-full rounded-lg bg-background/60 px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          )}
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={buttonId}
            aria-activedescendant={!searchable && shown.length ? optionId(active) : undefined}
            onKeyDown={searchable ? undefined : onListKey}
            className="max-h-[300px] overflow-y-auto p-1.5 focus:outline-none"
          >
            {shown.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No matches</li>}
            {shown.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 ${sm ? "py-2" : "py-2.5"} ${
                    i === active ? "bg-surface-2" : ""
                  }`}
                >
                  {o.icon && <span className="flex shrink-0 items-center">{o.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm ${isSelected ? "font-semibold text-foreground" : "text-foreground/90"}`}
                    >
                      {o.label}
                    </span>
                    {o.description && <span className="block text-xs text-muted">{o.description}</span>}
                  </span>
                  {isSelected && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className="shrink-0 text-accent"
                    >
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
