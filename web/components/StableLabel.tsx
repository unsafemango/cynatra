/**
 * Shows `current`, but keeps room for every label in `all`, so a button that
 * toggles between labels ("+ Watchlist" / "✓ On watchlist") never changes width
 * and nothing next to it moves.
 */
export function StableLabel({ current, all }: { current: string; all: readonly string[] }) {
  return (
    <span className="inline-grid">
      {all.map((label) => (
        <span
          key={label}
          aria-hidden={label !== current}
          className={`col-start-1 row-start-1 text-center ${label === current ? "" : "invisible"}`}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
