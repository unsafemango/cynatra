"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { formatRuntime, toSlug, type LibraryStatus, type Provider, type Title } from "@/lib/api";
import { providerUrl } from "@/lib/providers";
import { Rating } from "./Rating";
import { StableLabel } from "./StableLabel";

const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";

const TRAILER_LABELS = ["▶ Trailer", "Hide trailer"] as const;

const KIND_LABEL = { movie: "Movie", series: "Series", animation: "Animation" } as const;

const STATUS_TAG: Record<LibraryStatus, { label: string; className: string }> = {
  watchlist: { label: "🔖 On your watchlist", className: "border-accent-2/50 text-accent-2" },
  watching: { label: "▶ Watching", className: "border-info/50 text-info" },
  seen: { label: "✓ Seen", className: "border-success/50 text-success" },
};

export function ResultCard({
  title: t,
  actions,
  animate = true,
  status,
}: {
  title: Title;
  actions?: React.ReactNode;
  animate?: boolean;
  /** Where the title is in the viewer's library, shown as a tag. */
  status?: LibraryStatus;
}) {
  const [showTrailer, setShowTrailer] = useState(false);
  const trailerRef = useRef<HTMLIFrameElement>(null);

  // Next.js keeps pages you navigate away from mounted but hidden, and a hidden
  // iframe keeps playing. Worse, a Back navigation can move the hidden page in
  // the DOM, which reloads the iframe and (with autoplay) restarts the trailer.
  // So when this card is hidden: pause right away, then remove the player.
  const pauseTrailer = useRef(() => {});
  useLayoutEffect(() => {
    const frame = trailerRef.current;
    pauseTrailer.current = () =>
      frame?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
        YOUTUBE_ORIGIN,
      );
  }, [showTrailer]);
  useLayoutEffect(
    () => () => {
      pauseTrailer.current();
      setShowTrailer(false);
    },
    [],
  );
  const runtime = formatRuntime(t);
  const providers = t.whereToWatch;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-border bg-surface ${animate ? "animate-reveal" : ""}`}
    >
      {t.backdropUrl && (
        <Image
          src={t.backdropUrl}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover opacity-15 blur-sm scale-110"
          priority
        />
      )}
      <div className="relative grid sm:grid-cols-[220px_1fr] gap-6 p-5 sm:p-7">
        <div className="mx-auto w-48 sm:w-full">
          {t.posterUrl ? (
            <Image
              src={t.posterUrl}
              alt={`${t.title} poster`}
              width={500}
              height={750}
              className="rounded-xl shadow-2xl shadow-black/60 w-full h-auto"
              priority
            />
          ) : (
            <div className="aspect-[2/3] rounded-xl bg-surface-2 grid place-items-center text-muted text-sm">
              No poster
            </div>
          )}
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border">{KIND_LABEL[t.kind]}</span>
            {t.colorful && (
              <span className="px-2 py-0.5 rounded-full border border-accent-2/50 text-accent-2" title="Picked for its bright, colourful look">
                🦄 Bright &amp; colourful
              </span>
            )}
            {t.year && <span>{t.year}</span>}
            {runtime && <span>· {runtime}</span>}
            {t.seasons ? <span>· {t.seasons} season{t.seasons > 1 ? "s" : ""}</span> : null}
            {/* Last, so appearing after a library change doesn't move the rest. */}
            {status && (
              <span className={`px-2 py-0.5 rounded-full border ${STATUS_TAG[status].className}`}>
                <Link href={`/library?tab=${status}`} className="hover:underline underline-offset-2">
                  {STATUS_TAG[status].label}
                </Link>
              </span>
            )}
          </div>

          <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
            <Link href={`/t/${toSlug(t.id)}`} className="hover:underline decoration-accent underline-offset-4">
              {t.title}
            </Link>
          </h2>

          <div className="mt-2">
            <Rating title={t} />
          </div>

          {t.genres.length > 0 && <p className="mt-2 text-sm text-muted">{t.genres.join(" · ")}</p>}

          <p className="mt-4 text-[15px] leading-relaxed text-foreground/90">
            {t.overview || "No summary available."}
          </p>

          {providers && (providers.stream.length > 0 || providers.rent.length > 0) && (
            <div className="mt-5 space-y-2">
              <ProviderRow label="Stream" providers={providers.stream} title={t.title} watchPage={providers.link} />
              {providers.stream.length === 0 && (
                <ProviderRow label="Rent" providers={providers.rent} title={t.title} watchPage={providers.link} />
              )}
              <a href={providers.link} target="_blank" rel="noreferrer" className="text-xs text-muted hover:underline">
                All options on TMDB →
              </a>
            </div>
          )}

          <div className="mt-auto pt-6 flex flex-wrap gap-2">
            {t.trailerKey && (
              <button
                onClick={() => setShowTrailer((s) => !s)}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90"
              >
                <StableLabel current={showTrailer ? "Hide trailer" : "▶ Trailer"} all={TRAILER_LABELS} />
              </button>
            )}
            {actions}
          </div>
        </div>
      </div>

      {showTrailer && t.trailerKey && (
        <div className="relative px-5 sm:px-7 pb-7">
          <div className="aspect-video rounded-xl overflow-hidden border border-border">
            <iframe
              ref={trailerRef}
              // enablejsapi lets us send the pause command above.
              src={`${YOUTUBE_ORIGIN}/embed/${t.trailerKey}?autoplay=1&enablejsapi=1&playsinline=1`}
              title={`${t.title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </article>
  );
}

function ProviderRow({
  label,
  providers,
  title,
  watchPage,
}: {
  label: string;
  providers: Provider[];
  title: string;
  /** TMDB's "where to watch" page, for services we can't link to directly. */
  watchPage: string;
}) {
  if (providers.length === 0) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted w-12">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {providers.slice(0, 8).map((p) => (
          <a
            key={p.name}
            href={providerUrl(p.name, title, watchPage)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${label} on ${p.name}`}
            aria-label={`${label} ${title} on ${p.name} (opens in a new tab)`}
            className="rounded-md transition hover:-translate-y-0.5 hover:ring-2 hover:ring-foreground/40 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Image src={p.logo} alt="" width={32} height={32} className="rounded-md" />
          </a>
        ))}
      </div>
    </div>
  );
}
