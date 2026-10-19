import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import type { Person } from "@/lib/api";
import { getPerson } from "@/lib/server-api";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { PersonView } from "./PersonView";

// Rendered on the server, so search engines see who this is and what they've been in.

const describe = (p: Person) => {
  const known = p.knownForTitles
    .slice(0, 3)
    .map((t) => t.title)
    .join(", ");
  const lead = `${p.name}${p.knownFor ? ` (${p.knownFor.toLowerCase()})` : ""}: movies and TV shows${known ? `, including ${known}` : ""}. Find where to stream them.`;
  const bio = p.biography?.trim() ? ` ${p.biography.trim()}` : "";
  const text = lead + bio;
  return text.length > 300 ? `${text.slice(0, 297).replace(/\s+\S*$/, "")}…` : text;
};

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  let p: Person | null;
  try {
    p = await getPerson(id);
  } catch {
    // The API is having a moment: plain metadata, and the page loads in the browser.
    return { title: "Person" };
  }
  // Here rather than in the page, so the response is a real 404 (the page streams).
  if (!p) notFound();
  const description = describe(p);
  return {
    title: `${p.name}: movies & TV shows`,
    description,
    alternates: { canonical: `/p/${p.id}` },
    openGraph: {
      type: "profile",
      title: p.name,
      description,
      url: `/p/${p.id}`,
      images: p.photoUrl ? [{ url: p.photoUrl, alt: p.name }] : undefined,
    },
    twitter: {
      card: "summary",
      title: `${p.name} | ${SITE_NAME}`,
      description,
      images: p.photoUrl ? [p.photoUrl] : undefined,
    },
  };
}

export default function PersonPage({ params }: PageProps<"/p/[id]">) {
  // Route params are request-time data, so the page renders inside Suspense.
  return (
    <Suspense fallback={<div className="h-[360px] rounded-2xl bg-surface border border-border animate-pulse" />}>
      <PersonContent params={params} />
    </Suspense>
  );
}

async function PersonContent({ params }: { params: PageProps<"/p/[id]">["params"] }) {
  const { id } = await params;
  let person: Person | null;
  try {
    person = await getPerson(id);
  } catch {
    // The API is having a moment: let the browser try, as before.
    return <PersonView id={id} initial={null} />;
  }
  if (!person) notFound();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: person.name,
          url: `${SITE_URL}/p/${person.id}`,
          image: person.photoUrl,
          description: person.biography?.trim() || undefined,
          birthDate: person.birthday,
          deathDate: person.deathday,
          birthPlace: person.placeOfBirth,
          jobTitle: person.knownFor,
          alternateName: person.alsoKnownAs.length ? person.alsoKnownAs.slice(0, 5) : undefined,
          sameAs: [person.imdbUrl, person.instagramUrl, person.homepage, person.tmdbUrl].filter(Boolean),
        }}
      />
      <PersonView id={id} initial={person} />
    </>
  );
}
