import Link from "next/link";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { PresetSpin } from "@/components/PresetSpin";
import { RegionalGrid } from "./RegionalGrid";
import { toSlug } from "@/lib/api";
import { LANDING_PAGES, landingPath, type Landing } from "@/lib/landing";
import { getBrowse } from "@/lib/server-api";
import { SITE_URL } from "@/lib/site";

const SECTION_NAME = { random: "Random generators", streaming: "What to watch on…" } as const;

/** A landing page: heading and intro, the preset spin, popular picks, FAQ, related pages. */
export function LandingView({ page }: { page: Landing }) {
  const related = LANDING_PAGES.filter((l) => l.section === page.section && l.slug !== page.slug).slice(0, 8);
  const other = LANDING_PAGES.filter((l) => l.section !== page.section).slice(0, 6);
  return (
    <article className="mx-auto max-w-5xl space-y-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Discover", item: `${SITE_URL}/discover` },
                { "@type": "ListItem", position: 2, name: page.heading, item: `${SITE_URL}${landingPath(page)}` },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: page.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }}
      />

      <header className="space-y-5">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/discover" className="hover:text-foreground hover:underline underline-offset-4">
            Discover
          </Link>
          <span aria-hidden> › </span>
          <span>{SECTION_NAME[page.section]}</span>
        </nav>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{page.heading}</h1>
        <div className="max-w-3xl space-y-3 text-[17px] leading-relaxed text-foreground/90">
          {page.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <PresetSpin filters={page.filters} label={page.spinLabel} service={page.service} />
      </header>

      <section aria-labelledby="popular" className="space-y-4">
        <Suspense fallback={<GridSkeleton heading={page.gridHeading} />}>
          <PopularGrid page={page} />
        </Suspense>
      </section>

      <section aria-labelledby="faq" className="max-w-3xl space-y-5">
        <h2 id="faq" className="text-xl font-semibold">
          Questions
        </h2>
        {page.faq.map((f) => (
          <div key={f.q}>
            <h3 className="font-medium">{f.q}</h3>
            <p className="mt-1 leading-relaxed text-foreground/85">{f.a}</p>
          </div>
        ))}
      </section>

      <nav aria-labelledby="more" className="space-y-4 border-t border-border pt-8">
        <h2 id="more" className="text-xl font-semibold">
          More ways to pick
        </h2>
        <ul className="flex flex-wrap gap-2">
          {[...related, ...other].map((l) => (
            <li key={landingPath(l)}>
              <Link
                href={landingPath(l)}
                className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-muted hover:text-foreground"
              >
                {l.section === "streaming" ? `What to watch on ${l.linkLabel}` : l.linkLabel}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/discover"
              className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-foreground hover:border-muted"
            >
              All →
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}

async function PopularGrid({ page }: { page: Landing }) {
  let hits;
  try {
    hits = await getBrowse(page.filters, page.listRegion);
  } catch {
    return (
      <>
        <h2 id="popular" className="text-xl font-semibold">
          {page.gridHeading}
        </h2>
        <p className="text-muted">Couldn&apos;t load popular picks right now. The spin above still works.</p>
      </>
    );
  }
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: page.gridHeading,
          itemListElement: hits.map((h, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/t/${toSlug(h.id)}`,
            name: h.title,
          })),
        }}
      />
      <RegionalGrid
        initial={hits}
        heading={page.gridHeading}
        listRegion={page.listRegion}
        filters={page.filters}
        service={page.service}
      />
    </>
  );
}

function GridSkeleton({ heading }: { heading: string }) {
  return (
    <>
      <h2 id="popular" className="text-xl font-semibold">
        {heading}
      </h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-[2/3] rounded-xl bg-surface-2 animate-pulse" />
        ))}
      </div>
    </>
  );
}
