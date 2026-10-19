import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ServiceCards, type ServiceCard } from "@/components/landing/ServiceCards";
import { PosterTile } from "@/components/PosterTile";
import { toSlug, type ProviderOption, type SearchHit } from "@/lib/api";
import { RANDOM_PAGES, STREAMING_PAGES, landingPath, type Landing } from "@/lib/landing";
import { DEFAULT_REGION } from "@/lib/regions";
import { getBrowse, getProviders } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Discover: random movie generators and what to watch on each service",
  description:
    "Random movie, TV show and genre generators, plus what to watch tonight on Netflix, Prime Video, Disney+, Crave and more. One spin, one pick.",
  alternates: { canonical: "/discover" },
};

// How each generator looks here: an emoji, a few words, and a colour (hue).
const LOOK: Record<string, { emoji: string; tagline: string; hue: number }> = {
  movie: { emoji: "🎬", tagline: "One movie for tonight", hue: 352 },
  "tv-show": { emoji: "📺", tagline: "Your next binge", hue: 212 },
  animated: { emoji: "🎨", tagline: "From Pixar to Ghibli", hue: 280 },
  documentary: { emoji: "🎥", tagline: "True stories, nature, history", hue: 150 },
  "horror-movie": { emoji: "👻", tagline: "Ghosts, slashers, dread", hue: 0 },
  "comedy-movie": { emoji: "😂", tagline: "Guaranteed laughs", hue: 45 },
  "action-movie": { emoji: "💥", tagline: "Chases, heists, heroes", hue: 20 },
  "romance-movie": { emoji: "💘", tagline: "Love stories & rom-coms", hue: 330 },
  "sci-fi-movie": { emoji: "🚀", tagline: "Space, time and AI", hue: 190 },
  "thriller-movie": { emoji: "🔪", tagline: "Tension and twists", hue: 262 },
  "family-movie": { emoji: "🧸", tagline: "Fun for all ages", hue: 100 },
  "mystery-movie": { emoji: "🕵️", tagline: "Whodunits & puzzles", hue: 230 },
  "comedy-show": { emoji: "🛋️", tagline: "Sitcoms to put on", hue: 55 },
  "crime-show": { emoji: "🚔", tagline: "Detectives & heists", hue: 215 },
};
const look = (slug: string) => LOOK[slug] ?? { emoji: "🎲", tagline: "Spin for one", hue: 352 };

// The four broad kinds get big cards; every other generator is a genre.
const BY_TYPE = ["movie", "tv-show", "animated", "documentary"];

export default function DiscoverPage() {
  const byType = BY_TYPE.map((slug) => RANDOM_PAGES.find((p) => p.slug === slug)).filter((p): p is Landing => !!p);
  const byGenre = RANDOM_PAGES.filter((p) => !BY_TYPE.includes(p.slug));

  return (
    <div className="mx-auto max-w-5xl space-y-14">
      {/* Hero: what this page is, the fastest way to a pick, and a peek at what's popular. */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="pointer-events-none absolute -left-24 -top-28 size-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-10 size-72 rounded-full bg-accent-2/10 blur-3xl" />
        <div className="relative grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-sm font-medium text-accent">Discover</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.1]">
              Not sure what to watch? Pick a starting point.
            </h1>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-foreground/85">
              Each one spins up a random, well-rated pick and shows popular titles to browse. No sign-up needed.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/?spin=1"
                className="rounded-xl bg-accent px-5 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-[0.98]"
              >
                🎲 Spin anything
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-border bg-background/60 px-5 py-3 font-medium transition hover:border-muted"
              >
                Set your own filters
              </Link>
            </div>
          </div>
          <Suspense fallback={<CollageSkeleton />}>
            <PosterCollage />
          </Suspense>
        </div>
      </section>

      <Section title="Start with a type" subtitle="The quickest way in: one tap, one pick.">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {byType.map((p) => (
            <li key={p.slug}>
              <GeneratorCard page={p} large />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Pick a genre" subtitle="In the mood for something specific?">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {byGenre.map((p) => (
            <li key={p.slug}>
              <GeneratorCard page={p} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What's on your services" subtitle="Spin only from what you can stream right now.">
        <Suspense fallback={<ServiceCards services={streamingCards([])} />}>
          <Services />
        </Suspense>
      </Section>

      <Section title="Popular right now" subtitle="Well-rated movies and series people are watching.">
        <Suspense fallback={<StripSkeleton />}>
          <PopularStrip />
        </Suspense>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-muted">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function GeneratorCard({ page, large = false }: { page: Landing; large?: boolean }) {
  const { emoji, tagline, hue } = look(page.slug);
  return (
    <Link
      href={landingPath(page)}
      style={{ "--hue": hue } as React.CSSProperties}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-[hsl(var(--hue)_70%_60%/0.6)] hover:shadow-lg hover:shadow-black/20 ${
        large ? "gap-4 p-5 sm:p-6" : "gap-3 p-4"
      }`}
    >
      {/* A soft wash of the card's colour in the corner. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[hsl(var(--hue)_85%_60%/0.14)] blur-2xl"
      />
      <span
        aria-hidden
        className={`relative grid place-items-center rounded-xl bg-[hsl(var(--hue)_85%_60%/0.16)] ${
          large ? "size-14 text-3xl" : "size-11 text-2xl"
        }`}
      >
        {emoji}
      </span>
      <span className="relative min-w-0">
        <span className={`block font-semibold leading-snug ${large ? "text-lg" : ""}`}>
          {page.linkLabel.replace(/^Random /, "").replace(/^./, (c) => c.toUpperCase())}
        </span>
        <span className="mt-0.5 block text-sm text-muted">{tagline}</span>
      </span>
      <span className="relative mt-auto text-sm font-medium text-muted transition-colors group-hover:text-foreground">
        Spin <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

/** Streaming pages as cards, with logos where we have them. */
function streamingCards(providers: ProviderOption[]): ServiceCard[] {
  return STREAMING_PAGES.filter((p) => p.service).map((p) => ({
    key: p.service!.key,
    name: p.service!.name,
    href: landingPath(p),
    logo: providers.find((s) => s.key === p.service!.key)?.logo,
  }));
}

async function Services() {
  await connection(); // logos come from the API: at request time (cached), never at build time
  // Canada's list, plus the US for the services only offered there (Hulu, Peacock, HBO Max).
  const lists = await Promise.all([getProviders(DEFAULT_REGION), getProviders("US")].map((p) => p.catch(() => [])));
  return <ServiceCards services={streamingCards(lists.flat())} />;
}

async function popular(): Promise<SearchHit[]> {
  await connection();
  return getBrowse({ type: "any", minRating: 7 }, DEFAULT_REGION, 18).catch(() => []);
}

async function PosterCollage() {
  const hits = (await popular()).slice(0, 6);
  if (hits.length < 6) return null;
  return (
    <div className="hidden grid-cols-3 gap-3 md:grid" aria-hidden>
      {hits.map((h, i) => (
        <Link
          key={h.id}
          href={`/t/${toSlug(h.id)}`}
          tabIndex={-1}
          className={`relative aspect-[2/3] overflow-hidden rounded-xl border border-border shadow-xl shadow-black/40 transition hover:-translate-y-1 ${
            i % 3 === 1 ? "translate-y-5" : ""
          }`}
        >
          {h.posterUrl && <Image src={h.posterUrl} alt="" fill sizes="120px" className="object-cover" />}
        </Link>
      ))}
    </div>
  );
}

async function PopularStrip() {
  const hits = await popular();
  if (hits.length === 0) return <p className="text-muted">Nothing to show right now.</p>;
  return (
    // Swipe sideways on phones; wraps into a grid on wide screens.
    <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
      {hits.map((h) => (
        <li key={h.id} className="w-32 shrink-0 snap-start sm:w-auto">
          <PosterTile hit={h} sizes="(max-width: 640px) 128px, (max-width: 1024px) 22vw, 150px" />
        </li>
      ))}
    </ul>
  );
}

function CollageSkeleton() {
  return (
    <div className="hidden grid-cols-3 gap-3 md:grid" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className={`aspect-[2/3] rounded-xl bg-surface-2 animate-pulse ${i % 3 === 1 ? "translate-y-5" : ""}`}
        />
      ))}
    </div>
  );
}

function StripSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden sm:grid sm:grid-cols-4 lg:grid-cols-6" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="aspect-[2/3] w-32 shrink-0 rounded-xl bg-surface-2 animate-pulse sm:w-auto" />
      ))}
    </div>
  );
}
