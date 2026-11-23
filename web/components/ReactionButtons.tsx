"use client";

import type { Reaction } from "@/lib/api";
import { ThumbDownIcon, ThumbUpIcon } from "@/components/icons";

/**
 * Thumbs up and down for a title they've seen. Pressing the active one clears it.
 * `onChange` gets the new value, or null when cleared.
 */
export function ReactionButtons({
  reaction,
  onChange,
  titleName,
  className = "",
}: {
  reaction?: Reaction | null;
  onChange: (next: Reaction | null) => void;
  /** Used in the accessible names, e.g. "Like Dune". */
  titleName: string;
  className?: string;
}) {
  const btn = (kind: Reaction, label: string, Icon: typeof ThumbUpIcon, on: string) => {
    const active = reaction === kind;
    return (
      <button
        type="button"
        onClick={() => onChange(active ? null : kind)}
        aria-pressed={active}
        aria-label={`${label} ${titleName}`}
        title={active ? `Clear your ${kind}` : label}
        className={`grid place-items-center size-8 rounded-lg border transition-colors ${
          active ? on : "border-border text-muted hover:text-foreground hover:border-muted"
        }`}
      >
        <Icon width={16} height={16} fill={active ? "currentColor" : "none"} />
      </button>
    );
  };

  return (
    <span role="group" aria-label="Your reaction" className={`inline-flex gap-1.5 ${className}`}>
      {btn("like", "Like", ThumbUpIcon, "border-success/60 text-success bg-success/10")}
      {btn("dislike", "Dislike", ThumbDownIcon, "border-accent/60 text-accent bg-accent/10")}
    </span>
  );
}
