import Link from "next/link";

/** Shared layout for the Privacy and Terms pages: a title, a date, then sections. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: { heading: string; body: React.ReactNode }[];
}) {
  return (
    <article className="mx-auto max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-4 text-[15px] leading-relaxed text-foreground/90">{intro}</div>
      </header>
      <div className="mt-8 space-y-7">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-foreground/90 [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
              {s.body}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        Questions? <Link href="/help#contact" className="text-foreground underline underline-offset-4">Contact support</Link>{" "}
        or email <a href="mailto:support@cynatra.app" className="text-foreground underline underline-offset-4">support@cynatra.app</a>.
      </p>
    </article>
  );
}
