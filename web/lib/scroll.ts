// Height of the sticky header, so a revealed result isn't hidden under it.
const HEADER_PX = 64;

/**
 * Brings a spin result (or the loader before it) into view: smoothly scrolls
 * its top to just under the header, unless it's already entirely on screen.
 * Instant for people who prefer reduced motion.
 */
export function revealResult(el: HTMLElement | null) {
  if (!el) return;
  const box = el.getBoundingClientRect();
  if (box.height === 0) return;
  if (box.top >= HEADER_PX && box.bottom <= window.innerHeight) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}
