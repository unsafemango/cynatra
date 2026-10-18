"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TitleCard } from "@/components/TitleCard";
import { TitleInfo } from "@/components/TitleInfo";
import { api, fromSlug, type FullTitle } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Shareable page for a single title, e.g. /t/movie-603: the result card, then
// everything else about it (cast, crew, seasons, more like this).
//
// `initial` is the server's render (US streaming info, what logged-out visitors
// see). Logged-in visitors elsewhere get their own country's services in its
// place. Without `initial` (the server couldn't reach the API), it loads here.
export function TitleView({ slug, initial }: { slug: string; initial: FullTitle | null }) {
  const { user } = useAuth();
  const region = user?.region ?? "US";
  // Keyed by slug and region, so a "More like this" link never shows the old title's data.
  const [loaded, setLoaded] = useState<{ key: string; title?: FullTitle; error?: string } | null>(null);
  const key = `${slug}|${region}`;
  const needsFetch = !initial || region !== "US";

  useEffect(() => {
    if (!needsFetch) return;
    const [media, tmdbId] = fromSlug(slug).split(":");
    api<FullTitle>(`/api/title/${media}/${tmdbId}/full?region=${region}`)
      .then((title) => setLoaded({ key, title }))
      .catch((e) => setLoaded({ key, error: e.message }));
  }, [needsFetch, slug, region, key]);

  const current = loaded?.key === key ? loaded : null;
  // The server's copy until this country's arrives (same title, other services).
  const title = current?.title ?? initial;
  const error = !title ? current?.error : undefined;
  const ready = Boolean(title || error);

  return (
    <div className="space-y-6">
      {error && <p className="text-center text-muted pt-12">{error}</p>}
      {!ready && <div className="h-[360px] rounded-2xl bg-surface border border-border animate-pulse" />}
      {title && (
        <>
          <TitleCard key={title.id} title={title} animate={false} fetchStatus />
          <TitleInfo title={title} />
        </>
      )}
      {/* Only once loaded: under the short placeholder it would be pushed down when the page arrives. */}
      {ready && (
        <p className="text-center">
          {/* Spins right away with the visitor's saved filters, skipping this title. */}
          <Link href={`/?spin=1&skip=${slug}`} className="text-muted hover:text-foreground">
            Not feeling it? <span className="text-foreground">🎲 Spin for something else →</span>
          </Link>
        </p>
      )}
    </div>
  );
}
