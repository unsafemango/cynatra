"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { inRegion } from "@/lib/regions";
import { regionServiceKeys, useViewerRegion } from "@/lib/viewer-region";

export type ServiceCard = { key: string; name: string; href: string; logo?: string };

/**
 * The "What to watch on…" services as logo cards. Once the viewer's country is
 * known, the ones offered there come first and the rest are dimmed with a
 * "Not in Canada" label (they still open, and say so on their page).
 */
export function ServiceCards({ services }: { services: ServiceCard[] }) {
  const region = useViewerRegion();
  const [offered, setOffered] = useState<{ region: string; keys: string[] } | null>(null);
  useEffect(() => {
    if (!region) return;
    let live = true;
    regionServiceKeys(region)
      .then((keys) => live && setOffered({ region, keys }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [region]);

  const keys = offered && offered.region === region ? offered.keys : null;
  const isOffered = (s: ServiceCard) => !keys || keys.includes(s.key);
  // Stable sort: available first, otherwise the page's order.
  const sorted = keys ? [...services].sort((a, b) => Number(isOffered(b)) - Number(isOffered(a))) : services;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {sorted.map((s) => {
        const available = isOffered(s);
        return (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`group flex h-full flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-5 text-center transition hover:-translate-y-0.5 hover:border-muted hover:shadow-lg hover:shadow-black/20 ${
                available ? "" : "opacity-55 hover:opacity-90"
              }`}
            >
              {s.logo ? (
                <Image src={s.logo} alt="" width={56} height={56} className="rounded-xl shadow-md shadow-black/30" />
              ) : (
                <span className="grid size-14 place-items-center rounded-xl bg-surface-2 text-xl font-semibold" aria-hidden>
                  {s.name.charAt(0)}
                </span>
              )}
              <span className="text-sm font-medium leading-tight group-hover:underline decoration-accent underline-offset-4">
                {s.name}
              </span>
              <span className="text-xs text-muted">
                {available ? "What to watch →" : `Not in ${inRegion(region ?? "")}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
