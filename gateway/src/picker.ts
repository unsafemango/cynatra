import { config } from "./config.js";

/** Calls the Go picker service and returns its status and JSON body. */
export async function callPicker(path: string, init?: RequestInit) {
  const res = await fetch(config.pickerUrl + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(25_000),
  });
  return { status: res.status, body: await res.json() };
}

type Snapshot = { id?: unknown; imdbId?: string; imdb?: unknown };

/**
 * Updates saved title snapshots (watchlist, history...) in place with their
 * current IMDb rating, so titles saved before IMDb ratings existed show them
 * too. Best effort: on any failure the saved snapshot is shown as it was.
 */
export async function refreshIMDb(titles: unknown[]) {
  const snapshots = titles.filter(
    (t): t is Snapshot & { id: string } =>
      typeof t === "object" &&
      t !== null &&
      typeof (t as Snapshot).id === "string" &&
      /^(movie|tv):\d+$/.test((t as { id: string }).id),
  );
  const ids = [...new Set(snapshots.map((t) => t.id))].slice(0, 50);
  if (ids.length === 0) return;
  try {
    const { status, body } = await callPicker("/ratings", { method: "POST", body: JSON.stringify({ ids }) });
    if (status !== 200) return;
    for (const t of snapshots) {
      const r = (body as Record<string, { imdbId?: string; imdb?: unknown }>)[t.id];
      if (!r) continue;
      t.imdbId = r.imdbId;
      if (r.imdb) t.imdb = r.imdb;
      else delete t.imdb;
    }
  } catch {
    // Picker unreachable: keep what was saved.
  }
}
