import { CloseIcon } from "./icons";

/**
 * The × inside a search box that empties it. Place it in a `relative` wrapper
 * next to the input (which needs right padding for it); `onClear` should also
 * put the focus back in the box, ready to type again.
 */
export function ClearButton({ onClear, label = "Clear search" }: { onClear: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={label}
      title={label}
      className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground active:scale-90"
    >
      <span className="grid size-5 place-items-center rounded-full bg-muted/25">
        <CloseIcon width={12} height={12} strokeWidth={2.6} />
      </span>
    </button>
  );
}
