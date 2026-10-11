"use client";

import { useEffect, useState } from "react";

// Appears once you've scrolled about a screen down.
const SHOW_AFTER = 600;

/** Round button in the bottom-right corner that scrolls back to the top. */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
      aria-label="Back to top"
      title="Back to top"
      // `invisible` also takes it out of the tab order while hidden.
      className={`fixed bottom-5 right-5 z-30 grid size-11 place-items-center rounded-full border border-border bg-surface/90 text-foreground shadow-lg shadow-black/40 backdrop-blur transition-all duration-200 hover:border-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent sm:bottom-6 sm:right-6 ${
        visible ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}
