/** Bottom edge of the sticky header, notch padding included (installed on an iPhone it's taller). */
function headerBottom() {
  return document.querySelector("body > header")?.getBoundingClientRect().bottom ?? 64;
}

/** Top edge of the phones' bottom tab bar (the screen's bottom elsewhere). */
function tabBarTop() {
  return document.getElementById("tab-bar")?.getBoundingClientRect().top || window.innerHeight;
}

/**
 * Brings a spin result (or the loader before it) into view: smoothly scrolls
 * its top to just under the header (see scroll-padding-top in globals.css),
 * unless it's already entirely on screen. Instant for people who prefer
 * reduced motion.
 */
export function revealResult(el: HTMLElement | null) {
  if (!el) return;
  const box = el.getBoundingClientRect();
  if (box.height === 0) return;
  if (box.top >= headerBottom() && box.bottom <= tabBarTop()) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Whether `el` is on screen between the header and the tab bar. */
export function isOnScreen(el: HTMLElement | null) {
  if (!el) return false;
  const box = el.getBoundingClientRect();
  return box.height > 0 && box.bottom > headerBottom() && box.top < tabBarTop();
}
