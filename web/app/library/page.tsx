"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatRuntime, toSlug, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { markSeen, removeFromWatchlist, startWatching, stopWatching } from "@/lib/library";

type Item = {
  title: Title;
  seen: boolean;
  addedAt?: string;
  pickedAt?: string;
  seenAt?: string;
  startedAt?: string;
  id?: number;
};
type Tab = "watchlist" | "watching" | "seen" | "history";

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: "watchlist", label: "Watchlist", empty: "Nothing saved yet." },
  { id: "watching", label: "Watching", empty: "Nothing in progress. Start something from your watchlist or a spin." },
  { id: "seen", label: "Seen", empty: "Nothing marked as seen yet." },
  { id: "history", label: "History", empty: "No picks yet." },
];

const dateLabel = (item: Item) => {
  const [prefix, iso] = item.seenAt
    ? ["Seen", item.seenAt]
    : item.startedAt
      ? ["Started", item.startedAt]
      : item.pickedAt
        ? ["Picked", item.pickedAt]
        : ["Added", item.addedAt];
  return iso ? `${prefix} ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : null;
};

export default function LibraryPage() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<Tab>("watchlist");
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Short confirmation after an item moves between tabs.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api<{ items: Item[] }>(`/api/me/${tab}`)
      .then((r) => !cancelled && setItems(r.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load."));
    return () => {
      cancelled = true;
    };
  }, [user, tab]);

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    setItems(null);
    setError(null);
    setNotice(null);
  };

  if (ready && !user) {
    return (
      <p className="text-center text-muted pt-12">
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>{" "}
        to see your watchlist, what you&apos;re watching, and what you&apos;ve seen.
      </p>
    );
  }

  const toggleSeen = async (item: Item) => {
    const seen = !item.seen;
    await markSeen(item.title.id, true, seen, item.title);
    setItems((cur) => {
      if (!cur) return cur;
      // On the Seen tab, unmarking removes the row.
      if (tab === "seen" && !seen) return cur.filter((i) => i.title.id !== item.title.id);
      return cur.map((i) => (i.title.id === item.title.id ? { ...i, seen } : i));
    });
  };

  const dropRow = (item: Item) => setItems((cur) => cur?.filter((i) => i.title.id !== item.title.id) ?? null);

  const remove = async (item: Item) => {
    await removeFromWatchlist(item.title.id);
    dropRow(item);
  };

  const start = async (item: Item) => {
    await startWatching(item.title);
    if (tab === "watchlist") dropRow(item); // it moved to Watching
    setNotice(`Moved “${item.title.title}” to Watching.`);
  };

  const finish = async (item: Item) => {
    await markSeen(item.title.id, true, true, item.title);
    dropRow(item);
    setNotice(`Nice! “${item.title.title}” is now in Seen.`);
  };

  const stop = async (item: Item) => {
    await stopWatching(item.title.id);
    dropRow(item);
  };

  const clearHistory = async () => {
    if (!confirm("Clear your whole pick history?")) return;
    await api("/api/me/history", { method: "DELETE" });
    setItems([]);
  };

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => switchTab(t.id)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-sm transition-colors ${
                tab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "watchlist" && items && items.some((i) => !i.seen) && (
          <Link
            href="/?from=watchlist"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:brightness-110"
          >
            🎲 Pick one for me
          </Link>
        )}
        {tab === "history" && items && items.length > 0 && (
          <button onClick={clearHistory} className="text-sm text-muted hover:text-foreground">
            Clear history
          </button>
        )}
      </div>

      <div className="mt-6">
        {notice && (
          <p role="status" className="mb-4 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30 text-sm">
            {notice}
          </p>
        )}
        {error && <p className="text-accent">{error}</p>}
        {!items && !error && <ListSkeleton />}
        {items?.length === 0 && (
          <p className="text-muted text-center py-12">
            {current.empty}{" "}
            <Link href="/" className="text-foreground underline underline-offset-4">
              Go spin
            </Link>
          </p>
        )}
        <ul className="grid gap-3">
          {items?.map((item) => {
            const href = `/t/${toSlug(item.title.id)}`;
            return (
              <li
                key={item.id ?? item.title.id}
                className="group flex gap-4 p-3 rounded-xl bg-surface border border-border hover:border-muted/60 transition-colors"
              >
                <Link
                  href={href}
                  aria-label={`Open ${item.title.title}`}
                  className="relative shrink-0 w-20 sm:w-24 aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 shadow-lg shadow-black/40"
                >
                  {item.title.posterUrl ? (
                    <Image
                      src={item.title.posterUrl}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center p-2 text-center text-[11px] text-muted">
                      {item.title.title}
                    </span>
                  )}
                </Link>

                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="font-medium hover:underline underline-offset-4 line-clamp-2">
                      {item.title.title}
                    </Link>
                    <p className="text-xs text-muted mt-1">
                      {[item.title.year, `★ ${item.title.rating.toFixed(1)}`, formatRuntime(item.title)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {item.title.genres.length > 0 && (
                      <p className="text-xs text-muted mt-0.5 truncate">{item.title.genres.slice(0, 3).join(" · ")}</p>
                    )}
                    {dateLabel(item) && <p className="text-[11px] text-muted/80 mt-1.5">{dateLabel(item)}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {tab === "watching" ? (
                      <>
                        <button onClick={() => finish(item)} className={`${btn} ${primaryBtn}`}>
                          ✓ Finished
                        </button>
                        <button
                          onClick={() => stop(item)}
                          className={`${btn} ${quietBtn}`}
                          aria-label={`Stop watching ${item.title.title}`}
                        >
                          Stop
                        </button>
                      </>
                    ) : (
                      <>
                        {tab === "watchlist" && (
                          <button onClick={() => start(item)} className={`${btn} ${quietBtn}`}>
                            ▶ Start
                          </button>
                        )}
                        <button
                          onClick={() => toggleSeen(item)}
                          title={item.seen ? "Unmark as seen" : undefined}
                          className={`${btn} ${item.seen ? seenBtn : quietBtn}`}
                        >
                          {item.seen ? "✓ Seen" : "Mark seen"}
                        </button>
                        {tab === "watchlist" && (
                          <button
                            onClick={() => remove(item)}
                            className={`${btn} ${quietBtn}`}
                            aria-label={`Remove ${item.title.title}`}
                          >
                            Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const btn = "px-3 py-1.5 rounded-lg text-xs border transition-colors";
const quietBtn = "border-border text-muted hover:text-foreground hover:border-muted";
const seenBtn = "border-accent text-accent hover:bg-accent/10";
const primaryBtn = "border-accent bg-accent text-white hover:brightness-110";

function ListSkeleton() {
  return (
    <ul className="grid gap-3" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-4 p-3 rounded-xl bg-surface border border-border animate-pulse">
          <div className="w-20 sm:w-24 aspect-[2/3] rounded-lg bg-surface-2" />
          <div className="flex-1 pt-2 space-y-2">
            <div className="h-4 w-1/3 rounded bg-surface-2" />
            <div className="h-3 w-1/4 rounded bg-surface-2" />
          </div>
        </li>
      ))}
    </ul>
  );
}
