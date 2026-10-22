"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ServiceUnavailable } from "@/components/landing/ServiceUnavailable";
import { SpinLoader } from "@/components/SpinLoader";
import { actionBtn, TitleCard } from "@/components/TitleCard";
import { api, type Filters, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { localSeen } from "@/lib/library";
import { DEFAULT_REGION } from "@/lib/regions";
import { revealResult } from "@/lib/scroll";
import { useServiceAvailable, useViewerRegion } from "@/lib/viewer-region";

// Same feel as the Spin page: the reel shows long enough to read as a spin.
const MIN_SPIN_MS = 900;

/**
 * A landing page's spin: one button with the page's filters already set (e.g.
 * horror movies, or titles on Netflix), the result right below it, and a link
 * to the full Spin page for more filters.
 */
export function PresetSpin({
  filters,
  label,
  service,
}: {
  filters: Partial<Filters>;
  label: string;
  /** Streaming pages: replaced by a notice where the service isn't offered. */
  service?: { key: string; name: string; tips?: Record<string, string> };
}) {
  const { user } = useAuth();
  const [result, setResult] = useState<Title | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Titles shown during this visit, so spins don't repeat.
  const shown = useRef<string[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  // Set by a spin: show the loader, then the result, once each has rendered.
  const revealPending = useRef(false);
  useEffect(() => {
    if (!revealPending.current) return;
    revealResult(resultRef.current);
    if (!loading) revealPending.current = false;
  }, [loading, result, error]);
  // The profile's country, or a guess when logged out (Canada until known).
  const viewerRegion = useViewerRegion();
  const region = viewerRegion ?? DEFAULT_REGION;
  const available = useServiceAvailable(service?.key, viewerRegion);

  const spin = useCallback(async () => {
    setLoading(true);
    setError(null);
    const started = Date.now();
    revealPending.current = true;
    try {
      const excludeIds = [...shown.current.slice(-100), ...(user ? [] : localSeen().slice(-400))];
      const t = await api<Title>("/api/pick", {
        method: "POST",
        body: JSON.stringify({ type: "any", genres: [], minRating: 0, ...filters, region, excludeIds }),
      });
      shown.current.push(t.id);
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_SPIN_MS - (Date.now() - started))));
      setResult(t);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, [filters, region, user]);

  if (service && viewerRegion && available === false) {
    return <ServiceUnavailable service={service} region={viewerRegion} />;
  }

  return (
    <section aria-label="Spin" className="space-y-5">
      <button
        onClick={spin}
        disabled={loading}
        className="w-full rounded-2xl bg-accent px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:min-w-80"
      >
        {loading ? "Spinning…" : result ? "🎲 Spin again" : label}
      </button>

      <div ref={resultRef}>
        {loading && <SpinLoader />}
        {!loading && error && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-lg">😶 {error}</p>
          </div>
        )}
        {!loading && result && (
          <>
            <TitleCard key={result.id} title={result} onSeen={spin} />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted">
              <span>Not feeling it?</span>
              <button onClick={spin} className={actionBtn}>
                ↻ Spin again
              </button>
              <Link href="/" className={actionBtn}>
                More filters on the Spin page
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
