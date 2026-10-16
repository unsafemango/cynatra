"use client";

import type { Title } from "./api";

// What a logged-out visitor asked for before being sent to log in (e.g. "+ Watchlist"
// on a spin result), so it can be done once they're signed in, and the page to
// bring them back to. Kept in localStorage so it survives a new tab or a sign-up
// that takes a while (the emailed code), but only for an hour.
const PENDING_KEY = "cynatra:after-login";
// Titles just saved that way; their card says so when it next appears.
const DONE_KEY = "cynatra:after-login-done";
const MAX_AGE_MS = 60 * 60 * 1000;

type Pending = { watchlist: Title; at: number };

/** Remember to add `title` to the watchlist after the next sign-in. */
export function saveAfterLogin(title: Title) {
  try {
    // Only the latest one: the visitor clicked "+ Watchlist" on it just now.
    // Without the page-only extras (cast, seasons...) or the visitor's library tag.
    const snapshot: Title & { details?: unknown } = { ...title, library: undefined };
    delete snapshot.details;
    localStorage.setItem(PENDING_KEY, JSON.stringify({ watchlist: snapshot, at: Date.now() } satisfies Pending));
  } catch {
    // storage blocked: they'll just have to click again after logging in
  }
}

/** The title waiting to be added, if any (and not too old). Clears it. */
export function takePending(): Title | null {
  let p: Pending | null = null;
  try {
    p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    localStorage.removeItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (!p?.watchlist?.id || Date.now() - p.at > MAX_AGE_MS) return null;
  return p.watchlist;
}

/** Note that `id` was saved after signing in, for its card to mention. */
export function markSavedAfterLogin(id: string) {
  try {
    sessionStorage.setItem(DONE_KEY, id);
  } catch {
    // ignore
  }
}

/** True (once) if `id` was just added to the watchlist after signing in. */
export function takeSavedAfterLogin(id: string): boolean {
  try {
    if (sessionStorage.getItem(DONE_KEY) !== id) return false;
    sessionStorage.removeItem(DONE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * The page to return to after logging in, from `?next=`. Only paths on this
 * site (never `//evil.example` or a full URL), and never the auth pages.
 */
export function nextPath(search: string): string {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/^\/(login|register|logged-out)(\/|\?|$)/.test(next)) return "/";
  return next;
}

/** A link to the log in (or sign up) page that comes back to `path` afterwards. */
export function loginHref(path: string, page: "login" | "register" = "login"): string {
  return path && path !== "/" && !/^\/(login|register|logged-out)(\/|\?|$)/.test(path)
    ? `/${page}?next=${encodeURIComponent(path)}`
    : `/${page}`;
}
