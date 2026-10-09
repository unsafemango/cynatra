"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ResultCard } from "@/components/ResultCard";
import { api, fromSlug, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Shareable page for a single pick, e.g. /t/movie-603.
export function TitleView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [title, setTitle] = useState<Title | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const [media, tmdbId] = fromSlug(id).split(":");
    const region = user?.region ?? "US";
    api<Title>(`/api/title/${media}/${tmdbId}?region=${region}`)
      .then(setTitle)
      .catch((e) => setError(e.message));
  }, [id, user?.region]);

  return (
    <div className="space-y-6">
      {error && <p className="text-center text-muted pt-12">{error}</p>}
      {!title && !error && <div className="h-[360px] rounded-2xl bg-surface border border-border animate-pulse" />}
      {title && <ResultCard title={title} animate={false} />}
      <p className="text-center">
        <Link href="/" className="text-muted hover:text-foreground">
          🎲 Spin for your own pick →
        </Link>
      </p>
    </div>
  );
}
