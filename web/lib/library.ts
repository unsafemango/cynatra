"use client";

import { api, type Title } from "./api";

// Anonymous users keep "seen" marks in this browser; logged-in users keep them
// on the server so they follow the account.
const SEEN_KEY = "cynatra:seen";

export function localSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeLocalSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-1000)));
  } catch {
    // ignore
  }
}

/** After their seen marks are copied to a new sign-in's account. */
export function clearLocalSeen() {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // ignore
  }
}

/** Pass the title when marking seen so it shows up on the Seen tab. */
export async function markSeen(id: string, loggedIn: boolean, seen = true, title?: Title) {
  if (loggedIn) {
    await api(`/api/me/seen/${encodeURIComponent(id)}`, {
      method: seen ? "PUT" : "DELETE",
      body: seen && title ? JSON.stringify(title) : undefined,
    });
    return;
  }
  const ids = localSeen().filter((x) => x !== id);
  writeLocalSeen(seen ? [...ids, id] : ids);
}

export function addToWatchlist(t: Title) {
  return api("/api/me/watchlist", { method: "POST", body: JSON.stringify(t) });
}

/** Moves a title to Watching (and off the watchlist). */
export function startWatching(t: Title) {
  return api("/api/me/watching", { method: "POST", body: JSON.stringify(t) });
}

export function stopWatching(id: string) {
  return api(`/api/me/watching/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function removeFromWatchlist(id: string) {
  return api(`/api/me/watchlist/${encodeURIComponent(id)}`, { method: "DELETE" });
}
