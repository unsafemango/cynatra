"use client";

import { useEffect, useState } from "react";
import { PosterTile } from "@/components/PosterTile";
import { api, type Filters, type SearchHit } from "@/lib/api";
import { popularOn } from "@/lib/landing";
import { useServiceAvailable, useViewerRegion } from "@/lib/viewer-region";

const SIZES = "(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 150px";
const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6";

/**
 * A landing page's popular titles. Starts as the server's list (what search
 * engines see). On streaming pages it then follows the viewer's country (their
 * profile's, or a guess): that country's list where the service is offered,
 * else the server's list, labelled with its country, under the notice the
 * spin shows instead.
 */
export function RegionalGrid({
  initial,
  heading,
  listRegion,
  filters,
  service,
}: {
  initial: SearchHit[];
  /** The server's heading (random pages keep it; their lists don't depend on country). */
  heading: string;
  listRegion: string;
  filters: Partial<Filters>;
  service?: { key: string; name: string };
}) {
  const region = useViewerRegion();
  const available = useServiceAvailable(service?.key, region);
  // This country's list, keyed by country so a change of profile country never shows a stale one.
  const [regional, setRegional] = useState<{ region: string; hits: SearchHit[] } | null>(null);
  const wanted = service && region && region !== listRegion && available ? region : null;

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    api<SearchHit[]>("/api/browse", {
      method: "POST",
      body: JSON.stringify({ request: { type: "any", genres: [], minRating: 0, ...filters, region: wanted }, limit: 24 }),
    })
      .then((hits) => live && setRegional({ region: wanted, hits }))
      .catch(() => {}); // keep the server's list
    return () => {
      live = false;
    };
  }, [wanted, filters]);

  const shown = wanted && regional?.region === wanted ? regional : null;
  const hits = shown?.hits ?? initial;
  const title = service ? popularOn(service.name, shown?.region ?? listRegion) : heading;

  return (
    <>
      <h2 id="popular" className="text-xl font-semibold">
        {title}
      </h2>
      {hits.length === 0 ? (
        <p className="text-muted">Nothing to show here right now.</p>
      ) : (
        // Dims while the viewer's country loads, so the swap doesn't come out of nowhere.
        <ul className={`${GRID} transition-opacity ${wanted && !shown ? "opacity-60" : ""}`}>
          {hits.map((h) => (
            <li key={h.id}>
              <PosterTile hit={h} sizes={SIZES} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
