// Images come straight from TMDB's image CDN, which already has each one in a
// range of widths: we just pick the right width for the size it's shown at.
// Next's own resizing (/_next/image) did this work on our server and stored
// every resized copy in .next/cache, which crawlers going through thousands
// of title pages filled up until the web pod was evicted.

// Widths TMDB serves (it accepts any of these for posters, backdrops, profiles and logos).
const TMDB_WIDTHS = [92, 154, 185, 342, 500, 780, 1280];
const TMDB_IMAGE = /^https:\/\/image\.tmdb\.org\/t\/p\/(w\d+|original)\//;

export default function tmdbImageLoader({ src, width }: { src: string; width: number }) {
  const m = src.match(TMDB_IMAGE);
  if (!m) return src;
  // Never wider than the size the API chose (e.g. w92 for a logo).
  const max = m[1] === "original" ? Infinity : Number(m[1].slice(1));
  const fit = TMDB_WIDTHS.find((w) => w >= width) ?? TMDB_WIDTHS.at(-1)!;
  const size = Math.min(fit, max);
  return src.replace(TMDB_IMAGE, `https://image.tmdb.org/t/p/w${size}/`);
}
