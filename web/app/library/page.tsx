"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatRuntime, toSlug, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { markSeen, removeFromWatchlist } from "@/lib/library";

type Item = { title: Title; seen: boolean; addedAt?: string; pickedAt?: string; id?: number };
type Tab = "watchlist" | "history";

export default function LibraryPage() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<Tab>("watchlist");
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setTab(t);
    setItems(null);
    setError(null);
  };

  if (ready && !user) {
    return (
      <p className="text-center text-muted pt-12">
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>{" "}
        to see your watchlist and history.
      </p>
    );
  }

  const toggleSeen = async (item: Item) => {
    await markSeen(item.title.id, true, !item.seen);
    setItems((cur) => cur?.map((i) => (i.title.id === item.title.id ? { ...i, seen: !item.seen } : i)) ?? null);
  };

  const remove = async (item: Item) => {
    await removeFromWatchlist(item.title.id);
    setItems((cur) => cur?.filter((i) => i.title.id !== item.title.id) ?? null);
  };

  const clearHistory = async () => {
    if (!confirm("Clear your whole pick history?")) return;
    await api("/api/me/history", { method: "DELETE" });
    setItems([]);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
          {(["watchlist", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm capitalize ${tab === t ? "bg-surface-2 text-foreground" : "text-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "history" && items && items.length > 0 && (
          <button onClick={clearHistory} className="text-sm text-muted hover:text-foreground">
            Clear history
          </button>
        )}
      </div>

      <div className="mt-6">
        {error && <p className="text-accent">{error}</p>}
        {!items && !error && <p className="text-muted">Loading…</p>}
        {items?.length === 0 && (
          <p className="text-muted text-center py-12">
            {tab === "watchlist" ? "Nothing saved yet." : "No picks yet."}{" "}
            <Link href="/" className="text-foreground underline underline-offset-4">
              Go spin
            </Link>
          </p>
        )}
        <ul className="grid gap-3">
          {items?.map((item) => (
            <li
              key={item.id ?? item.title.id}
              className="flex gap-4 p-3 rounded-xl bg-surface border border-border items-center"
            >
              {item.title.posterUrl ? (
                <Image
                  src={item.title.posterUrl}
                  alt=""
                  width={56}
                  height={84}
                  className="rounded-md w-14 h-auto shrink-0"
                />
              ) : (
                <div className="w-14 h-21 rounded-md bg-surface-2 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/t/${toSlug(item.title.id)}`} className="font-medium hover:underline">
                  {item.title.title}
                </Link>
                <p className="text-xs text-muted mt-0.5">
                  {[
                    item.title.year,
                    `★ ${item.title.rating.toFixed(1)}`,
                    formatRuntime(item.title),
                    item.pickedAt && new Date(item.pickedAt).toLocaleDateString(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => toggleSeen(item)}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${item.seen ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"}`}
                >
                  {item.seen ? "✓ Seen" : "Mark seen"}
                </button>
                {tab === "watchlist" && (
                  <button
                    onClick={() => remove(item)}
                    className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted hover:text-foreground"
                    aria-label={`Remove ${item.title.title}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
