"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AddToShortlistButton } from "@/components/AddToShortlistButton";
import { Pagination } from "@/components/Pagination";
import { useRatingText } from "@/components/Rating";
import { StableLabel } from "@/components/StableLabel";
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
type PageData = { items: Item[]; total: number; page: number; pageSize: number };

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
  const ratingText = useRatingText();
  const [tab, setTab] = useState<Tab>("watchlist");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  // Refetches the current page (after a row leaves it) without showing the skeleton.
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Short confirmation after an item moves between tabs.
  const [notice, setNotice] = useState<string | null>(null);
  const [urlRead, setUrlRead] = useState(false);
  // Item count per tab: labels the tabs and lets an empty tab show its empty
  // message right away instead of a loading placeholder.
  const [counts, setCounts] = useState<Record<Tab, number> | null>(null);
  const [countsTick, setCountsTick] = useState(0);
  // Which tab/page has been loading long enough to deserve a placeholder.
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const listTop = useRef<HTMLDivElement>(null);
  const items = data?.items ?? null;

  // Restore tab/page from the URL (e.g. coming Back from a title page).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get("tab") as Tab | null;
    const p = Number(params.get("page"));
    /* eslint-disable react-hooks/set-state-in-effect */
    if (t && TABS.some((x) => x.id === t)) setTab(t);
    if (p > 1) setPage(Math.floor(p));
    setUrlRead(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Keep the URL in sync so Back and refresh land on the same page.
  useEffect(() => {
    if (!urlRead) return;
    const qs = new URLSearchParams();
    if (tab !== "watchlist") qs.set("tab", tab);
    if (page > 1) qs.set("page", String(page));
    const query = qs.toString();
    const next = `/library${query ? `?${query}` : ""}`;
    if (location.pathname + location.search !== next) history.replaceState(null, "", next);
  }, [tab, page, urlRead]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!user || !urlRead) return;
    let cancelled = false;
    api<Record<Tab, number>>("/api/me/counts")
      .then((c) => !cancelled && setCounts(c))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, urlRead, reload, countsTick]);

  // Counts can change while this (kept-alive) page is hidden, e.g. a spin adds
  // to History; forget them so a stale 0 never shows an empty tab by mistake.
  useLayoutEffect(() => () => setCounts(null), []);

  // Only show the loading placeholder if a load takes noticeably long.
  const loadKey = `${tab}:${page}`;
  useEffect(() => {
    if (data) return;
    const t = setTimeout(() => setSlowKey(loadKey), 250);
    return () => clearTimeout(t);
  }, [data, loadKey]);

  useEffect(() => {
    if (!user || !urlRead) return;
    let cancelled = false;
    api<PageData>(`/api/me/${tab}?page=${page}`)
      .then((r) => {
        if (cancelled) return;
        // Past the end (e.g. the last row of the last page was removed): go back a page.
        if (r.items.length === 0 && r.total > 0 && page > 1) {
          setPage(Math.ceil(r.total / r.pageSize));
          return;
        }
        setData(r);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, tab, page, reload, urlRead]);

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    setPage(1);
    setData(null);
    setError(null);
    setNotice(null);
  };

  const goToPage = (p: number) => {
    setPage(p);
    setLoading(true);
    listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  /** Removes a row right away, then refetches so the next item moves up into this page. */
  const dropRow = (item: Item) => {
    setData((cur) =>
      cur && { ...cur, total: cur.total - 1, items: cur.items.filter((i) => i.title.id !== item.title.id) },
    );
    setReload((n) => n + 1);
  };

  const toggleSeen = async (item: Item) => {
    const seen = !item.seen;
    await markSeen(item.title.id, true, seen, item.title);
    // On the Seen tab, unmarking removes the row.
    if (tab === "seen" && !seen) return dropRow(item);
    setData((cur) => cur && { ...cur, items: cur.items.map((i) => (i.title.id === item.title.id ? { ...i, seen } : i)) });
    setCountsTick((n) => n + 1); // the Seen tab's count changed
  };

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
    setPage(1);
    setData((cur) => cur && { ...cur, items: [], total: 0, page: 1 });
    setCountsTick((n) => n + 1);
  };

  const current = TABS.find((t) => t.id === tab)!;
  const knownEmpty = !items && !error && counts?.[tab] === 0;
  const showSkeleton = !items && !error && !knownEmpty && slowKey === loadKey;

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
              {/* Counts only where there's room; four tabs just fit on a phone. */}
              {/* Room for the count is kept before it loads, so the tabs don't widen. */}
              <span className="hidden sm:inline-block ml-1.5 min-w-[2ch] text-left text-xs tabular-nums text-muted">
                {counts ? counts[t.id] : ""}
              </span>
            </button>
          ))}
        </div>
        {tab === "watchlist" && data && data.total > 0 && (
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

      <div ref={listTop} className="mt-6 scroll-mt-20">
        {notice && (
          <p role="status" className="mb-4 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30 text-sm">
            {notice}
          </p>
        )}
        {error && <p className="text-accent">{error}</p>}
        {showSkeleton && <ListSkeleton rows={Math.min(3, counts?.[tab] ?? 3)} />}
        {(items?.length === 0 || knownEmpty) && (
          <p className="text-muted text-center py-12">
            {current.empty}{" "}
            <Link href="/" className="text-foreground underline underline-offset-4">
              Go spin
            </Link>
          </p>
        )}
        <ul className={`grid gap-3 transition-opacity ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
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
                      {[item.title.year, ratingText(item.title), formatRuntime(item.title)]
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
                          <StableLabel current={item.seen ? "✓ Seen" : "Mark seen"} all={["Mark seen", "✓ Seen"]} />
                        </button>
                        {(tab === "watchlist" || tab === "history") && (
                          <AddToShortlistButton title={item.title} className={`${btn} ${quietBtn}`} />
                        )}
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
        {data && (
          <Pagination
            page={page}
            pageSize={data.pageSize}
            total={data.total}
            onChange={goToPage}
            disabled={loading}
          />
        )}
      </div>
    </div>
  );
}

const btn = "px-3 py-1.5 rounded-lg text-xs border transition-colors";
const quietBtn = "border-border text-muted hover:text-foreground hover:border-muted";
const seenBtn = "border-accent text-accent hover:bg-accent/10";
const primaryBtn = "border-accent bg-accent text-white hover:brightness-110";

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="grid gap-3" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
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
