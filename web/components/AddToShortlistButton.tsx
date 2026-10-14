"use client";

import type { Title } from "@/lib/api";
import { SHORTLIST_MAX, useShortlist, type ShortlistItem } from "@/lib/shortlist";
import { StableLabel } from "./StableLabel";

const LABELS = ["+ Shortlist", "✓ Shortlisted", "Shortlist full"] as const;

/** "+ Shortlist" toggle: adds the title, or removes it if it's already there. */
export function AddToShortlistButton({ title, className }: { title: Title | ShortlistItem; className: string }) {
  const { items, has, add, remove, loaded } = useShortlist();
  const inList = has(title.id);
  const full = !inList && items.length >= SHORTLIST_MAX;

  return (
    <button
      type="button"
      disabled={!loaded || full}
      aria-pressed={inList}
      onClick={() => (inList ? remove(title.id) : add(title))}
      title={
        full
          ? `Your shortlist already has ${SHORTLIST_MAX} titles. Remove one to add this.`
          : inList
            ? "Remove from your shortlist"
            : "Add to tonight's shortlist"
      }
      className={`${className} ${inList ? "!border-accent-2/60 !text-accent-2" : ""}`}
    >
      <StableLabel current={inList ? "✓ Shortlisted" : full ? "Shortlist full" : "+ Shortlist"} all={LABELS} />
    </button>
  );
}
