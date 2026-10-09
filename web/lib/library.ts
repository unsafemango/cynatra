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

export async function markSeen(id: string, loggedIn: boolean, seen = true) {
  if (loggedIn) {
    await api(`/api/me/seen/${encodeURIComponent(id)}`, { method: seen ? "PUT" : "DELETE" });
    return;
  }
  const ids = localSeen().filter((x) => x !== id);
  writeLocalSeen(seen ? [...ids, id] : ids);
}

export function addToWatchlist(t: Title) {
  return api("/api/me/watchlist", { method: "POST", body: JSON.stringify(t) });
}

export function removeFromWatchlist(id: string) {
  return api(`/api/me/watchlist/${encodeURIComponent(id)}`, { method: "DELETE" });
}
