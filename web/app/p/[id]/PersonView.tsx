"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Filmography } from "@/components/Filmography";
import { PosterTile } from "@/components/PosterTile";
import { api, type Person } from "@/lib/api";

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Whole years between two YYYY-MM-DD dates (to today when `to` is missing). */
function age(from: string, to?: string) {
  const a = new Date(from);
  const b = to ? new Date(to) : new Date();
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) {
    years--;
  }
  return years;
}

// Long biographies start folded to about this many characters.
const BIO_PREVIEW = 700;

/**
 * An actor or crew member: who they are, what they're known for, and everything
 * they've been in. `initial` is the server's render; without it (the server
 * couldn't reach the API) it loads here.
 */
export function PersonView({ id, initial }: { id: string; initial: Person | null }) {
  // Keyed by ID, so moving between people shows the skeleton, not the previous person.
  const [loaded, setLoaded] = useState<{ id: string; person?: Person; error?: string } | null>(null);

  useEffect(() => {
    if (initial) return;
    api<Person>(`/api/person/${id}`)
      .then((person) => setLoaded({ id, person }))
      .catch((e) => setLoaded({ id, error: e.message }));
  }, [id, initial]);

  const current = initial ? { id, person: initial } : loaded?.id === id ? loaded : null;
  if (!current) return <div className="h-[360px] rounded-2xl bg-surface border border-border animate-pulse" />;
  if (current.error || !current.person) return <p className="text-center text-muted pt-12">{current.error}</p>;
  // Keyed so "Read more" and the filmography view reset for each person.
  return <PersonDetails key={current.person.id} person={current.person} />;
}

function PersonDetails({ person: p }: { person: Person }) {
  const [bioOpen, setBioOpen] = useState(false);

  const bio = p.biography?.trim() ?? "";
  const longBio = bio.length > BIO_PREVIEW;
  const shownBio = longBio && !bioOpen ? `${bio.slice(0, BIO_PREVIEW).replace(/\s+\S*$/, "")}…` : bio;
  const movies = p.credits.filter((c) => c.mediaType === "movie").length;
  const links = [
    { label: "IMDb", href: p.imdbUrl },
    { label: "Instagram", href: p.instagramUrl },
    { label: "Official site", href: p.homepage },
    { label: "TMDB", href: p.tmdbUrl },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  return (
    <div className="space-y-8">
      <article className="grid gap-6 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-[200px_1fr] sm:p-7">
        <div className="mx-auto w-40 sm:w-full">
          {p.photoUrl ? (
            <Image
              src={p.photoUrl}
              alt={p.name}
              width={500}
              height={750}
              className="h-auto w-full rounded-xl shadow-2xl shadow-black/60"
              priority
            />
          ) : (
            <div
              className="grid aspect-[2/3] place-items-center rounded-xl bg-surface-2 text-5xl text-muted"
              aria-hidden
            >
              {p.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          {p.knownFor && (
            <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {p.knownFor}
            </span>
          )}
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{p.name}</h1>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {p.birthday && (
              <>
                <dt className="text-muted">Born</dt>
                <dd>
                  {formatDate(p.birthday)}
                  {!p.deathday && ` (age ${age(p.birthday)})`}
                  {p.placeOfBirth && <span className="text-muted"> · {p.placeOfBirth}</span>}
                </dd>
              </>
            )}
            {p.deathday && (
              <>
                <dt className="text-muted">Died</dt>
                <dd>
                  {formatDate(p.deathday)}
                  {p.birthday && ` (aged ${age(p.birthday, p.deathday)})`}
                </dd>
              </>
            )}
            {p.alsoKnownAs.length > 0 && (
              <>
                <dt className="text-muted">Also known as</dt>
                <dd>{p.alsoKnownAs.join(", ")}</dd>
              </>
            )}
            <dt className="text-muted">Credits</dt>
            <dd>
              {movies} movie{movies === 1 ? "" : "s"} · {p.credits.length - movies} series
            </dd>
          </dl>

          <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-foreground/90">
            {shownBio ? (
              shownBio.split(/\n+/).map((para, i) => <p key={i}>{para}</p>)
            ) : (
              <p className="text-muted">No biography available.</p>
            )}
          </div>
          {longBio && (
            <button
              type="button"
              onClick={() => setBioOpen((o) => !o)}
              aria-expanded={bioOpen}
              className="mt-2 text-sm text-muted hover:text-foreground"
            >
              {bioOpen ? "Show less" : "Read more"}
            </button>
          )}

          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-foreground hover:underline"
              >
                {l.label} ↗
              </a>
            ))}
          </p>
        </div>
      </article>

      {p.knownForTitles.length > 0 && (
        <section aria-labelledby="known-for">
          <h2 id="known-for" className="mb-3 text-lg font-semibold">
            Known for
          </h2>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
            {p.knownForTitles.map((hit) => (
              <li key={hit.id}>
                <PosterTile hit={hit} sizes="(max-width: 640px) 30vw, 120px" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.credits.length > 0 && <Filmography credits={p.credits} />}
    </div>
  );
}
