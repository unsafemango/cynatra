// Cynatra's "Dice-Play" mark: a die whose three pips form a play button.
// Designed on the Cynatra Logo canvas; keep the geometry in sync with app/icon.svg.

const PIPS = [
  [24, 20],
  [24, 44],
  [46, 32],
] as const;

/** The mark on its own. Pips grow slightly at small sizes so they stay readable. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const r = size <= 16 ? 7.5 : size <= 28 ? 7 : 6.5;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="var(--accent)" />
      {PIPS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#FFF8F2" />
      ))}
    </svg>
  );
}

/** Mark + "cynatra" wordmark, sized from the mark. */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.32 }}>
      <LogoMark size={size} />
      <span
        className="font-semibold leading-none"
        style={{ fontSize: size * 0.78, letterSpacing: "-0.045em" }}
      >
        cynatra
      </span>
    </span>
  );
}
