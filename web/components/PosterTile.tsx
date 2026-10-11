import Image from "next/image";
import Link from "next/link";
import { toSlug, type SearchHit } from "@/lib/api";

const KIND_LABEL = { movie: "Movie", series: "Series", animation: "Animation" } as const;

/** Poster, title and year, linking to the title page. */
export function PosterTile({ hit, sizes = "(max-width: 640px) 45vw, 180px" }: { hit: SearchHit; sizes?: string }) {
  return (
    <Link href={`/t/${toSlug(hit.id)}`} className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-accent">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface-2 transition group-hover:border-muted">
        {hit.posterUrl ? (
          <Image
            src={hit.posterUrl}
            alt=""
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center p-3 text-center text-sm text-muted">{hit.title}</span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug group-hover:underline decoration-accent underline-offset-4">
        {hit.title}
      </p>
      <p className="text-xs text-muted">{[hit.year, KIND_LABEL[hit.kind]].filter(Boolean).join(" · ")}</p>
    </Link>
  );
}
