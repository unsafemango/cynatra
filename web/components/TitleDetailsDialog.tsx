"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, toSlug, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ShortlistItem } from "@/lib/shortlist";
import { ResultCard } from "./ResultCard";

/**
 * Details for a shortlisted title, in a modal over the page: summary, rating,
 * trailer and where to watch. Closes with ×, Escape, or a click outside.
 */
export function TitleDetailsDialog({
  item,
  onClose,
  onRemove,
}: {
  item: ShortlistItem;
  onClose: () => void;
  onRemove: () => void;
}) {
  const { user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState<Title | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Open as a modal (focus moves in, Escape closes); stop the page scrolling behind it.
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
      if (d?.open) d.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const [media, id] = item.id.split(":");
    api<Title>(`/api/title/${media}/${id}?region=${user?.region ?? "US"}`)
      .then((t) => !cancelled && setTitle(t))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load the details."));
    return () => {
      cancelled = true;
    };
  }, [item.id, user?.region]);

  return (
    <dialog
      ref={dialog}
      aria-label={`${item.title} details`}
      onCancel={(e) => {
        e.preventDefault(); // let React unmount it
        onClose();
      }}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-transparent p-0 text-foreground backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="relative">
        <button
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full border border-border bg-surface/90 text-lg text-muted shadow hover:text-foreground hover:border-muted"
        >
          ×
        </button>

        {title ? (
          <ResultCard
            title={title}
            animate={false}
            actions={
              <>
                <Link href={`/t/${toSlug(title.id)}`} className={secondaryBtn}>
                  Open full page
                </Link>
                <button
                  onClick={() => {
                    onRemove();
                    onClose();
                  }}
                  className={`${secondaryBtn} text-accent`}
                >
                  Remove from shortlist
                </button>
              </>
            }
          />
        ) : error ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="font-medium">{item.title}</p>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-7" aria-busy>
            <div className="grid sm:grid-cols-[220px_1fr] gap-6 animate-pulse">
              <div className="mx-auto w-48 sm:w-full aspect-[2/3] rounded-xl bg-surface-2" />
              <div className="space-y-3 pt-2">
                <div className="h-4 w-24 rounded bg-surface-2" />
                <div className="h-7 w-2/3 rounded bg-surface-2" />
                <div className="h-4 w-32 rounded bg-surface-2" />
                <div className="h-20 w-full rounded bg-surface-2" />
              </div>
            </div>
            <p className="sr-only">Loading details for {item.title}…</p>
          </div>
        )}
      </div>
    </dialog>
  );
}

const secondaryBtn =
  "px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm hover:border-muted disabled:opacity-60";
