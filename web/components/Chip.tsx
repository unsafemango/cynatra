import type { ReactNode } from "react";

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
        active
          ? "bg-accent border-accent text-white"
          : "bg-surface border-border text-muted hover:text-foreground hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}
