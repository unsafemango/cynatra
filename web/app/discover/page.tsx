import type { Metadata } from "next";
import Link from "next/link";
import { RANDOM_PAGES, STREAMING_PAGES, landingPath, type Landing } from "@/lib/landing";

export const metadata: Metadata = {
  title: "Discover: random movie generators and what to watch on each service",
  description:
    "Random movie, TV show and genre generators, plus what to watch tonight on Netflix, Prime Video, Disney+, Hulu, HBO Max and more. One spin, one pick.",
  alternates: { canonical: "/discover" },
};

export default function DiscoverPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Discover something to watch</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-foreground/90">
          Pick a starting point and spin. Each page picks a random, well-rated title for you and lists popular ones to
          browse. For every filter at once (genres, years, runtime, language, your services), use the{" "}
          <Link href="/" className="font-medium text-foreground underline underline-offset-4">
            Spin page
          </Link>
          .
        </p>
      </header>
      <Section title="Random generators" pages={RANDOM_PAGES} />
      <Section title="What to watch on…" pages={STREAMING_PAGES} />
    </div>
  );
}

function Section({ title, pages }: { title: string; pages: Landing[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => (
          <li key={p.slug}>
            <Link
              href={landingPath(p)}
              className="group block h-full rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-muted"
            >
              <span className="font-medium group-hover:underline decoration-accent underline-offset-4">{p.heading}</span>
              <span className="mt-1.5 line-clamp-2 block text-sm text-muted">{p.intro[0]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
