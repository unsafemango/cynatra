"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SHOW_MS = 2600;

/**
 * A short message floating at the bottom of the screen, so confirmations
 * ("Added to your watchlist") don't push the page around. Returns the element
 * to render and a function to show a message.
 */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const show = useCallback((text: string) => setToast({ text, id: Date.now() }), []);

  // Rendered on <body>: inside a transformed ancestor, `fixed` would stick to it instead.
  const element =
    typeof document === "undefined"
      ? null
      : createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
          >
            {toast && (
              <p
                key={toast.id}
                role="status"
                className="animate-pop rounded-full border border-border bg-surface-2 px-4 py-2 text-sm text-foreground shadow-xl shadow-black/40"
              >
                {toast.text}
              </p>
            )}
          </div>,
          document.body,
        );

  return [element, show] as const;
}
