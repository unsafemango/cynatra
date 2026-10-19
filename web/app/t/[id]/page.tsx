import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { toSlug, type FullTitle } from "@/lib/api";
import { getTitle } from "@/lib/server-api";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { TitleView } from "./TitleView";

// Rendered on the server, so search engines and link previews see the title,
// its summary, cast and where to stream it. The view then takes over in the browser.

const describe = (t: FullTitle) => {
  const kind = t.mediaType === "tv" ? "series" : "movie";
  const lead = `${t.title}${t.year ? ` (${t.year})` : ""}: where to stream the ${kind}, trailer, cast and ratings.`;
  const summary = t.overview ? ` ${t.overview}` : "";
  const text = lead + summary;
  return text.length > 300 ? `${text.slice(0, 297).replace(/\s+\S*$/, "")}…` : text;
};

export async function generateMetadata({ params }: PageProps<"/t/[id]">): Promise<Metadata> {
  const { id } = await params;
  let t: FullTitle | null;
  try {
    t = await getTitle(id);
  } catch {
    // The API is having a moment: plain metadata, and the page loads in the browser.
    return { title: "Movie or series" };
  }
  // Here rather than in the page, so the response is a real 404 (the page streams).
  if (!t) notFound();
  const title = `${t.title}${t.year ? ` (${t.year})` : ""}: where to stream, trailer & ratings`;
  const description = describe(t);
  const image = t.backdropUrl ?? t.posterUrl;
  return {
    title,
    description,
    alternates: { canonical: `/t/${toSlug(t.id)}` },
    openGraph: {
      type: t.mediaType === "tv" ? "video.tv_show" : "video.movie",
      title: `${t.title}${t.year ? ` (${t.year})` : ""}`,
      description,
      url: `/t/${toSlug(t.id)}`,
      images: image ? [{ url: image, alt: `${t.title}` }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${t.title}${t.year ? ` (${t.year})` : ""} | ${SITE_NAME}`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function TitlePage({ params }: PageProps<"/t/[id]">) {
  // Route params are request-time data, so the page renders inside Suspense.
  return (
    <Suspense fallback={<div className="h-[360px] rounded-2xl bg-surface border border-border animate-pulse" />}>
      <TitleContent params={params} />
    </Suspense>
  );
}

async function TitleContent({ params }: { params: PageProps<"/t/[id]">["params"] }) {
  const { id } = await params;
  let title: FullTitle | null;
  try {
    title = await getTitle(id);
  } catch {
    // The API is having a moment: let the browser try, as before.
    return <TitleView slug={id} initial={null} />;
  }
  if (!title) notFound();
  return (
    <>
      <JsonLd data={structuredData(title)} />
      <TitleView slug={id} initial={title} />
    </>
  );
}

/** schema.org Movie / TVSeries. No ratings: Google only accepts ratings collected on the site itself. */
function structuredData(t: FullTitle) {
  const d = t.details;
  const people = (job: string) =>
    d.crew.find((c) => c.job === job)?.people.map((p) => ({ "@type": "Person", name: p.name, url: `${SITE_URL}/p/${p.id}` }));
  const directors = people("Director") ?? [];
  const creators = d.createdBy.map((p) => ({ "@type": "Person", name: p.name, url: `${SITE_URL}/p/${p.id}` }));
  return {
    "@context": "https://schema.org",
    "@type": t.mediaType === "tv" ? "TVSeries" : "Movie",
    name: t.title,
    url: `${SITE_URL}/t/${toSlug(t.id)}`,
    description: t.overview || undefined,
    image: t.posterUrl,
    datePublished: d.releaseDate,
    genre: t.genres.length ? t.genres : undefined,
    duration: t.mediaType === "movie" && t.runtime ? `PT${Math.floor(t.runtime / 60)}H${t.runtime % 60}M` : undefined,
    contentRating: d.certification,
    inLanguage: d.originalLanguage,
    numberOfSeasons: t.mediaType === "tv" ? t.seasons : undefined,
    director: directors.length ? directors : undefined,
    creator: creators.length ? creators : undefined,
    actor: d.cast.slice(0, 10).map((c) => ({ "@type": "Person", name: c.name, url: `${SITE_URL}/p/${c.id}` })),
    sameAs: [d.imdbUrl, t.tmdbUrl].filter(Boolean),
  };
}
