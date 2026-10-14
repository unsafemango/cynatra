"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TitleCard } from "@/components/TitleCard";
import { TitleInfo } from "@/components/TitleInfo";
import { api, fromSlug, type FullTitle } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Shareable page for a single title, e.g. /t/movie-603: the result card, then
// everything else about it (cast, crew, seasons, more like this).
export function TitleView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  // Keyed by slug, so following a "More like this" link shows the skeleton, not the old title.
  const [loaded, setLoaded] = useState<{ id: string; title?: FullTitle; error?: string } | null>(null);

  useEffect(() => {
    const [media, tmdbId] = fromSlug(id).split(":");
    const region = user?.region ?? "US";
    api<FullTitle>(`/api/title/${media}/${tmdbId}/full?region=${region}`)
      .then((title) => setLoaded({ id, title }))
      .catch((e) => setLoaded({ id, error: e.message }));
  }, [id, user?.region]);

  const current = loaded?.id === id ? loaded : null;
  const title = current?.title;

  return (
    <div className="space-y-6">
      {current?.error && <p className="text-center text-muted pt-12">{current.error}</p>}
      {!current && <div className="h-[360px] rounded-2xl bg-surface border border-border animate-pulse" />}
      {title && (
        <>
          <TitleCard key={title.id} title={title} animate={false} fetchStatus />
          <TitleInfo title={title} />
        </>
      )}
      {/* Only once loaded: under the short placeholder it would be pushed down when the page arrives. */}
      {current && (
        <p className="text-center">
          {/* Spins right away with the visitor's saved filters, skipping this title. */}
          <Link href={`/?spin=1&skip=${id}`} className="text-muted hover:text-foreground">
            Not feeling it? <span className="text-foreground">🎲 Spin for something else →</span>
          </Link>
        </p>
      )}
    </div>
  );
}
