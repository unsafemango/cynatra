"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AddToShortlistButton } from "@/components/AddToShortlistButton";
import { ResultCard } from "@/components/ResultCard";
import { StableLabel } from "@/components/StableLabel";
import { useToast } from "@/components/Toast";
import { api, toSlug, type LibraryStatus, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addToWatchlist, localSeen, markSeen, removeFromWatchlist, startWatching, stopWatching } from "@/lib/library";

export const actionBtn =
  "px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm hover:border-muted disabled:opacity-60";
const onBtn = "!border-accent-2/60 !text-accent-2";

const WATCHLIST_LABELS = ["+ Watchlist", "✓ On watchlist"] as const;
const WATCHING_LABELS = ["▶ Start watching", "✓ Watching"] as const;
const SEEN_LABELS = ["Seen it", "✓ Seen"] as const;

/**
 * A title's result card with its actions: watchlist, watching, seen, shortlist
 * and share. Each library button toggles, and the card's tag follows along.
 * Used for spin results and on title pages.
 */
export function TitleCard({
  title,
  initialStatus,
  fetchStatus = false,
  before,
  onSeen,
  animate = true,
}: {
  title: Title;
  /** Known library status (e.g. from a spin). */
  initialStatus?: LibraryStatus;
  /** Look the status up instead (title pages). */
  fetchStatus?: boolean;
  /** Extra buttons first (e.g. Reroll). */
  before?: React.ReactNode;
  /** Called after marking it seen (the spin page rerolls). */
  onSeen?: () => void;
  animate?: boolean;
}) {
  const { user, ready } = useAuth();
  const [status, setStatus] = useState<LibraryStatus | undefined>(initialStatus);
  // A save in progress: further clicks wait, without greying the buttons out (no flicker).
  const busy = useRef(false);
  const [toast, notify] = useToast();

  // Title pages: find out whether it's already in the library.
  useEffect(() => {
    if (!fetchStatus || !ready) return;
    let live = true;
    if (user) {
      api<{ status: LibraryStatus | null }>(`/api/me/status/${encodeURIComponent(title.id)}`)
        .then((r) => live && setStatus(r.status ?? undefined))
        .catch(() => {});
    } else if (localSeen().includes(title.id)) {
      setStatus("seen"); // eslint-disable-line react-hooks/set-state-in-effect
    }
    return () => {
      live = false;
    };
  }, [fetchStatus, ready, user, title.id]);

  // Runs one library change; the result shows as a toast so nothing on the page moves.
  const run = async (change: () => Promise<unknown>, next: LibraryStatus | undefined, done?: string) => {
    if (busy.current) return false;
    busy.current = true;
    try {
      await change();
      setStatus(next);
      if (done) notify(done);
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't save.");
      return false;
    } finally {
      busy.current = false;
    }
  };

  const toggleWatchlist = () =>
    status === "watchlist"
      ? run(() => removeFromWatchlist(title.id), undefined, "Removed from your watchlist")
      : run(() => addToWatchlist(title), "watchlist", "Added to your watchlist");

  const toggleWatching = () =>
    status === "watching"
      ? run(() => stopWatching(title.id), undefined, "Removed from Watching")
      : run(() => startWatching(title), "watching", "Moved to Watching");

  const toggleSeen = async () => {
    if (status === "seen") {
      await run(() => markSeen(title.id, Boolean(user), false), undefined, "No longer marked as seen");
      return;
    }
    if (await run(() => markSeen(title.id, Boolean(user), true, title), "seen", onSeen ? undefined : "Marked as seen"))
      onSeen?.();
  };

  const share = async () => {
    const url = `${location.origin}/t/${toSlug(title.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: title.title, text: "Watch this tonight:", url });
      else {
        await navigator.clipboard.writeText(url);
        notify("Link copied!");
      }
    } catch {
      // share sheet cancelled
    }
  };

  return (
    <ResultCard
      title={title}
      animate={animate}
      status={status}
      actions={
        <>
          {before}
          {user ? (
            <>
              <button
                onClick={toggleWatchlist}
                disabled={status === "watching" || status === "seen"}
                aria-pressed={status === "watchlist"}
                title={status === "watchlist" ? "Remove from your watchlist" : "Save it for later"}
                className={`${actionBtn} ${status === "watchlist" ? onBtn : ""}`}
              >
                <StableLabel
                  current={status === "watchlist" ? "✓ On watchlist" : "+ Watchlist"}
                  all={WATCHLIST_LABELS}
                />
              </button>
              <button
                onClick={toggleWatching}
                disabled={status === "seen"}
                aria-pressed={status === "watching"}
                title={status === "watching" ? "Stop watching" : "Mark as started"}
                className={`${actionBtn} ${status === "watching" ? onBtn : ""}`}
              >
                <StableLabel
                  current={status === "watching" ? "✓ Watching" : "▶ Start watching"}
                  all={WATCHING_LABELS}
                />
              </button>
            </>
          ) : (
            <Link href="/login" className={actionBtn}>
              + Watchlist
            </Link>
          )}
          <AddToShortlistButton title={title} className={actionBtn} />
          <button
            onClick={toggleSeen}
            aria-pressed={status === "seen"}
            title={status === "seen" ? "Unmark as seen" : "Never suggest this again"}
            className={`${actionBtn} ${status === "seen" ? onBtn : ""}`}
          >
            <StableLabel current={status === "seen" ? "✓ Seen" : "Seen it"} all={SEEN_LABELS} />
          </button>
          <button onClick={share} className={actionBtn}>
            Share
          </button>
          {toast}
        </>
      }
    />
  );
}
