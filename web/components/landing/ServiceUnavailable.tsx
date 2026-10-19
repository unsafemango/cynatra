"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STREAMING_PAGES, landingPath } from "@/lib/landing";
import { flag, inRegion } from "@/lib/regions";
import { regionServiceKeys } from "@/lib/viewer-region";

/**
 * Shown instead of a streaming page's spin when the service isn't offered in
 * the viewer's country: says so, gives a tip if there is one (e.g. HBO series
 * are on Crave in Canada), and links to the pages for services that are.
 */
export function ServiceUnavailable({
  service,
  region,
}: {
  service: { key: string; name: string; tips?: Record<string, string> };
  region: string;
}) {
  const [offered, setOffered] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    regionServiceKeys(region)
      .then((keys) => live && setOffered(keys))
      .catch(() => live && setOffered([]));
    return () => {
      live = false;
    };
  }, [region]);

  const alternatives = (offered ?? []).length
    ? STREAMING_PAGES.filter((p) => p.service && p.service.key !== service.key && offered!.includes(p.service.key))
    : [];
  const tip = service.tips?.[region];

  return (
    <div role="status" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-lg font-medium">
        {flag(region)} {service.name} isn&apos;t available in {inRegion(region)}
      </p>
      <p className="mt-1 text-muted">
        {tip ? `${tip} ` : ""}
        Spins here only pick what you can stream where you are, so there&apos;s nothing to pick from {service.name}.
        {alternatives.length > 0 && " Try one of these instead:"}
      </p>
      {alternatives.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {alternatives.map((p) => (
            <li key={p.slug}>
              <Link
                href={landingPath(p)}
                className="inline-flex rounded-full border border-border bg-background px-3.5 py-1.5 text-sm hover:border-muted"
              >
                What to watch on {p.linkLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-muted">
        Wrong country?{" "}
        <Link href="/profile" className="text-foreground underline underline-offset-4">
          Change it on your profile
        </Link>
        .
      </p>
    </div>
  );
}
