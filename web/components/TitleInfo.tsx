import Image from "next/image";
import Link from "next/link";
import { PosterTile } from "@/components/PosterTile";
import type { FullTitle, PersonRef } from "@/lib/api";

// Dates come as YYYY-MM-DD; formatting in UTC keeps them from shifting a day.
const formatDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
    : undefined;

const formatMoney = (n?: number) =>
  n
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n)
    : undefined;

/** Everything about a title beyond the card: facts, cast, crew, seasons and more like it. */
export function TitleInfo({ title: t }: { title: FullTitle }) {
  const d = t.details;
  const series = t.mediaType === "tv";
  const ended = d.status === "Ended" || d.status === "Canceled";

  const facts: [string, React.ReactNode][] = [
    [series ? "First aired" : "Released", formatDate(d.releaseDate)],
    ["Last aired", series && ended ? formatDate(d.lastAirDate) : undefined],
    ["Status", d.status],
    ["Rated", d.certification],
    ["Seasons", series && t.seasons ? `${t.seasons} · ${d.episodes ?? "?"} episodes` : undefined],
    ["Original title", d.originalTitle],
    ["Original language", d.originalLanguage],
    ["Spoken languages", d.languages.length > 1 ? d.languages.join(", ") : undefined],
    [d.countries.length > 1 ? "Countries" : "Country", d.countries.join(", ") || undefined],
    ["Created by", d.createdBy.length > 0 ? <People people={d.createdBy} /> : undefined],
    ["Network", d.networks.map((n) => n.name).join(", ") || undefined],
    ["Production", d.companies.slice(0, 4).join(", ") || undefined],
    ["Budget", formatMoney(d.budget)],
    ["Box office", formatMoney(d.revenue)],
    ["Part of", d.collection],
  ];
  const links = [
    { label: "IMDb", href: d.imdbUrl },
    { label: "Official site", href: d.homepage },
    { label: "TMDB", href: t.tmdbUrl },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  return (
    <div className="space-y-6">
      {d.tagline && <p className="text-center text-lg italic text-muted">“{d.tagline}”</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            {facts
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        </Panel>

        {d.crew.length > 0 && (
          <Panel title={series ? "Crew (all seasons)" : "Crew"}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
              {d.crew.map((g) => (
                <div key={g.job} className="contents">
                  <dt className="text-muted">{g.job}</dt>
                  <dd>
                    <People people={g.people} />
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}
      </div>

      {d.cast.length > 0 && (
        <Panel title="Cast">
          <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {d.cast.map((c, i) => (
              <li key={`${c.id}-${i}`} className="w-28 shrink-0 snap-start">
                <Link
                  href={`/p/${c.id}`}
                  className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-transparent bg-surface-2 transition group-hover:border-muted">
                    {c.photoUrl ? (
                      <Image src={c.photoUrl} alt="" fill sizes="112px" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-2xl text-muted" aria-hidden>
                        {c.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-snug group-hover:underline decoration-accent underline-offset-4">
                    {c.name}
                  </p>
                  {c.character && <p className="text-xs leading-snug text-muted">{c.character}</p>}
                  {c.episodes ? <p className="text-xs text-muted/70">{c.episodes} ep.</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {d.seasonList.length > 0 && (
        <Panel title="Seasons">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.seasonList.map((s) => (
              <li key={s.number} className="flex items-center gap-3">
                <div className="relative h-18 w-12 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  {s.posterUrl && <Image src={s.posterUrl} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted">
                    {[s.year, `${s.episodes} episode${s.episodes === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {(d.keywords.length > 0 || links.length > 0) && (
        <Panel title="Keywords & links">
          {d.keywords.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {d.keywords.map((k) => (
                <li key={k} className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted">
                  {k}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
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
        </Panel>
      )}

      {d.recommendations.length > 0 && (
        <section aria-labelledby="more-like-this">
          <h2 id="more-like-this" className="mb-3 text-lg font-semibold">
            More like this
          </h2>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
            {d.recommendations.map((hit) => (
              <li key={hit.id}>
                <PosterTile hit={hit} sizes="(max-width: 640px) 30vw, 160px" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Comma-separated names, each linking to that person's page. */
function People({ people }: { people: PersonRef[] }) {
  return people.map((p, i) => (
    <span key={p.id}>
      {i > 0 && ", "}
      <Link href={`/p/${p.id}`} className="hover:underline decoration-accent underline-offset-4">
        {p.name}
      </Link>
    </span>
  ));
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
