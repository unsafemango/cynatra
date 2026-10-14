// Where a streaming-service logo links to. TMDB doesn't give per-service links
// to a title, so for services with a predictable search page we open their
// search for the title; anything else goes to TMDB's "where to watch" page,
// which links to the title on every service.

const SEARCH: [match: RegExp, url: (q: string) => string][] = [
  [/^netflix/i, (q) => `https://www.netflix.com/search?q=${q}`],
  [/^amazon (prime )?video/i, (q) => `https://www.primevideo.com/search?phrase=${q}`],
  [/^apple tv/i, (q) => `https://tv.apple.com/search?term=${q}`],
  [/^youtube/i, (q) => `https://www.youtube.com/results?search_query=${q}`],
  [/^google play/i, (q) => `https://play.google.com/store/search?q=${q}&c=movies`],
  [/^hulu/i, (q) => `https://www.hulu.com/search?q=${q}`],
  [/^crunchyroll/i, (q) => `https://www.crunchyroll.com/search?q=${q}`],
  [/^tubi/i, (q) => `https://tubitv.com/search/${q}`],
];

/** Link for a provider logo: the service's search for the title, or TMDB's watch page. */
export function providerUrl(provider: string, title: string, watchPage: string) {
  const search = SEARCH.find(([match]) => match.test(provider));
  return search ? search[1](encodeURIComponent(title)) : watchPage;
}
