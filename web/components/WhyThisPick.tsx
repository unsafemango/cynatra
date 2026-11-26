import type { Why } from "@/lib/api";

/** One line on what a pick has in common with the viewer's likes. */
export function WhyThisPick({ why }: { why: Why }) {
  const reasons = [
    ...(why.people ?? []),
    ...(why.genres ?? []),
    ...(why.decade ? [`the ${why.decade}s`] : []),
  ];
  if (reasons.length === 0) return null;
  return (
    <p className="mb-3 text-sm text-muted">
      <span aria-hidden>✨ </span>
      Why this pick: you&apos;ve liked <span className="text-foreground">{list.format(reasons)}</span>
    </p>
  );
}

const list = new Intl.ListFormat("en", { type: "conjunction" });
