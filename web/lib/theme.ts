"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_KEY as KEY } from "./theme-script";

/** "system" follows the device's light/dark setting. */
export type ThemeChoice = "system" | "light" | "dark";
const CHANGED = "cynatra:theme-changed";

function readChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

const systemQuery = () => window.matchMedia("(prefers-color-scheme: light)");

function subscribe(onChange: () => void) {
  const media = systemQuery();
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
    media.removeEventListener("change", onChange);
  };
}

/** The visitor's theme choice, what it looks like right now, and a setter. Saved in this browser. */
export function useTheme() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as const);
  const resolved = useSyncExternalStore(
    subscribe,
    () => (readChoice() === "system" ? (systemQuery().matches ? "light" : "dark") : readChoice()),
    () => "dark" as const,
  );
  const setChoice = useCallback((t: ThemeChoice) => {
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      // Storage unavailable (private mode): applies until reload.
    }
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return { choice, resolved, setChoice };
}
