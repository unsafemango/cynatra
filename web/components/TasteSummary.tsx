"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type TasteProfile } from "@/lib/api";

// How many of each kind to name on either side.
const SHOWN = { genres: 5, decades: 3, people: 5 };

/** The genres, decades and people the viewer's likes and dislikes point to. */
export function TasteSummary() {
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [failed, setFailed] = useState(false);

  // Runs again when the (kept-alive) page is shown, so new ratings appear.
  useEffect(() => {
    let cancelled = false;
    api<TasteProfile>("/api/me/taste")
      .then((t) => {
        if (cancelled) return;
        setTaste(t);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!taste) {
    return failed ? (
      <p className="text-sm text-muted">Couldn&apos;t load your taste. Try again in a moment.</p>
    ) : (
      <div aria-hidden className="h-16 rounded-2xl bg-surface-2 animate-pulse" />
    );
  }

  if (taste.ratings === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing yet. Give a thumbs up or down to{" "}
        <Link href="/library?tab=seen" className="text-foreground underline underline-offset-4">
          titles you&apos;ve seen
        </Link>{" "}
        and spins can lean toward what you like.
      </p>
    );
  }

  const liked = side(taste, 1);
  const disliked = side(taste, -1);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Based on {taste.ratings} rated {taste.ratings === 1 ? "title" : "titles"}.
      </p>
      {liked.length > 0 && <Traits heading="You lean toward" traits={liked} />}
      {disliked.length > 0 && <Traits heading="You lean away from" traits={disliked} />}
      {liked.length + disliked.length === 0 && (
        <p className="text-sm text-muted">No clear leaning yet. Rate a few more.</p>
      )}
    </div>
  );
}

type Trait = { id: string; label: string; href?: string };
type Group = { kind: string; items: Trait[] };

/** The strongest liked (sign 1) or disliked (-1) traits, leaving out empty kinds. */
function side(taste: TasteProfile, sign: 1 | -1): Group[] {
  const pick = <T extends { weight: number }>(all: T[], n: number) => all.filter((w) => w.weight * sign > 0).slice(0, n);
  return [
    {
      kind: "Genres",
      items: pick(taste.genres, SHOWN.genres).map((g) => ({ id: g.key, label: g.key })),
    },
    {
      kind: "Decades",
      items: pick(taste.decades, SHOWN.decades).map((d) => ({ id: String(d.key), label: `${d.key}s` })),
    },
    {
      kind: "People",
      items: pick(taste.people, SHOWN.people).map((p) => ({ id: String(p.key), label: p.name, href: `/p/${p.key}` })),
    },
  ].filter((g) => g.items.length > 0);
}

function Traits({ heading, traits }: { heading: string; traits: Group[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{heading}</h3>
      <dl className="mt-2 space-y-2">
        {traits.map((group) => (
          <div key={group.kind} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline">
            <dt className="w-20 shrink-0 text-xs text-muted">{group.kind}</dt>
            <dd>
              <ul className="flex flex-wrap gap-2">
                {group.items.map((t) => (
                  <li key={t.id} className="rounded-full border border-border bg-surface-2 text-sm">
                    {t.href ? (
                      <Link href={t.href} className="block rounded-full px-3 py-1 hover:text-accent">
                        {t.label}
                      </Link>
                    ) : (
                      <span className="block px-3 py-1">{t.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
