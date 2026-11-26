import Link from "next/link";

/**
 * Whether spins lean toward what the viewer liked. With nothing rated yet there's
 * nothing to match, so it says how to get started instead.
 */
export function MatchTasteToggle({
  on,
  onChange,
  ratings,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  /** Titles rated so far (null while loading). */
  ratings: number | null;
}) {
  if (ratings === 0) {
    return (
      <p className="text-center text-sm text-muted">
        <Link href="/library?tab=seen" className="text-foreground underline-offset-4 hover:underline">
          Rate titles you&apos;ve seen
        </Link>{" "}
        and spins can match your taste.
      </p>
    );
  }
  return (
    <div className="flex justify-center">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        title="Favour titles like the ones you liked"
        className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span
          aria-hidden
          className={`flex h-5 w-9 items-center rounded-full border px-0.5 transition-colors ${
            on ? "border-accent bg-accent" : "border-border bg-surface-2"
          }`}
        >
          <span
            className={`size-3.5 rounded-full transition-transform ${on ? "translate-x-4 bg-white" : "bg-muted"}`}
          />
        </span>
        Match my taste
      </button>
    </div>
  );
}
