import type { Filters } from "./api";

// Landing pages for what people search for ("random horror movie generator",
// "what to watch on Netflix tonight"): each one spins with preset filters and
// lists popular matching titles. Shown at /random/[slug] and /streaming/[slug],
// collected on /discover, listed in /sitemaps/discover.xml.

export type Landing = {
  slug: string;
  section: "random" | "streaming";
  /** Page heading, and the main thing people search for. */
  heading: string;
  /** <title>, before " | Cynatra". */
  title: string;
  description: string;
  /** Short name for links on other pages. */
  linkLabel: string;
  intro: string[];
  /** What the spin uses (on top of the Spin page's quality floor). */
  filters: Partial<Filters>;
  spinLabel: string;
  gridHeading: string;
  /** The country the popular list is for (streaming pages); the spin uses the visitor's. */
  listRegion: string;
  /** Spin in this country whatever the visitor's (a service only offered there). */
  spinRegion?: string;
  faq: { q: string; a: string }[];
};

const MIN_RATING = 6.5;

const random = (
  slug: string,
  noun: string,
  filters: Partial<Filters>,
  intro: string[],
  faq: { q: string; a: string }[],
): Landing => ({
  slug,
  section: "random",
  heading: `Random ${noun} generator`,
  title: `Random ${noun} generator: pick one to watch tonight`,
  description: `Can't pick a ${noun} to watch? Spin for a random, well-rated ${noun} with its trailer, ratings and where to stream it. Free, no sign-up.`,
  linkLabel: `Random ${noun}`,
  intro,
  filters: { minRating: MIN_RATING, ...filters },
  spinLabel: `🎲 Spin a random ${noun}`,
  gridHeading: `Popular ${noun}s to start with`,
  listRegion: "US",
  faq,
});

const HOW_IT_WORKS = {
  q: "How does the random pick work?",
  a: "Each spin picks at random from popular titles with enough votes to be worth your evening and a good rating (6.5 or more on IMDb). A spin won't repeat what it already showed you, and if you log in it skips anything you've marked as seen.",
};

export const RANDOM_PAGES: Landing[] = [
  random(
    "movie",
    "movie",
    { type: "movie" },
    [
      "Scrolling through streaming menus until it's too late to start anything? Hit Spin and get one movie: its trailer, IMDb rating, runtime, and which services have it in your country.",
      "Not feeling it? Spin again, or narrow it down by genre, decade, length or streaming service on the main Spin page.",
    ],
    [
      HOW_IT_WORKS,
      {
        q: "Can I only get movies on my streaming services?",
        a: "Yes. On the Spin page, open Filters and choose your services under Streaming on. Every pick is then something you can watch without paying extra.",
      },
    ],
  ),
  random(
    "tv-show",
    "TV show",
    { type: "series" },
    [
      "Finished your last series and don't know what to start next? Spin for a random, well-rated TV show and see the trailer, how many seasons there are, and where it's streaming.",
      "Good for binge-hunting: each spin is a show other people actually liked, not whatever a service is pushing this week.",
    ],
    [
      HOW_IT_WORKS,
      {
        q: "Does it include miniseries and anime?",
        a: "Yes. Any series with enough ratings can come up, including miniseries. For animated shows only, try the animation generator.",
      },
    ],
  ),
  random(
    "horror-movie",
    "horror movie",
    { type: "movie", genres: ["horror"] },
    [
      "In the mood to be scared but stuck choosing? Spin for a random horror movie, from slashers and ghost stories to psychological horror, and only ones with good ratings.",
      "Each pick shows the trailer first, so you can check how scary it looks before you commit.",
    ],
    [
      HOW_IT_WORKS,
      {
        q: "Can I get older horror classics?",
        a: "Yes. On the Spin page, set Release years (for example 1970 to 1999) and add the Horror genre to get classics only.",
      },
    ],
  ),
  random(
    "comedy-movie",
    "comedy movie",
    { type: "movie", genres: ["comedy"] },
    [
      "Need a laugh tonight? Spin for a random comedy movie with a solid rating, so you skip the ones that only look funny in the trailer.",
      "Watching with family or friends? Add a runtime limit or the Family genre on the Spin page to keep it light and short.",
    ],
    [
      HOW_IT_WORKS,
      {
        q: "Can I avoid long comedies?",
        a: "Yes. On the Spin page, set a maximum runtime, such as 100 minutes, and add the Comedy genre.",
      },
    ],
  ),
  random(
    "action-movie",
    "action movie",
    { type: "movie", genres: ["action"] },
    [
      "Want car chases, heists or a big superhero fight? Spin for a random action movie that people actually rated well, with the trailer and where to stream it.",
      "Spin again as many times as you like: picks don't repeat during your visit.",
    ],
    [HOW_IT_WORKS],
  ),
  random(
    "romance-movie",
    "romance movie",
    { type: "movie", genres: ["romance"] },
    [
      "Date night, or just in the mood for a love story? Spin for a random romance movie, from romantic comedies to big tearjerkers, all with good ratings.",
      "Want something light? On the Spin page, combine Romance with Comedy for a rom-com.",
    ],
    [HOW_IT_WORKS],
  ),
  random(
    "sci-fi-movie",
    "sci-fi movie",
    { type: "movie", genres: ["scifi"] },
    [
      "Space, time travel, AI, alien worlds: spin for a random science fiction movie with a good rating, plus its trailer and where it's streaming.",
      "Try a few spins. Sci-fi ranges from blockbusters to small, mind-bending films, and you'll see both.",
    ],
    [HOW_IT_WORKS],
  ),
  random(
    "thriller-movie",
    "thriller movie",
    { type: "movie", genres: ["thriller"] },
    [
      "Looking for something tense, with twists you don't see coming? Spin for a random thriller movie, from crime and spy stories to psychological thrillers.",
      "Each pick lists the cast and runtime, so you know what you're in for before pressing play.",
    ],
    [HOW_IT_WORKS],
  ),
  random(
    "family-movie",
    "family movie",
    { type: "movie", genres: ["family"] },
    [
      "Movie night with the kids? Spin for a random family movie that both adults and children rate well, with the age rating shown on each title page.",
      "For animated picks only, try the animation generator.",
    ],
    [
      HOW_IT_WORKS,
      {
        q: "How do I know a movie suits my kids?",
        a: "Open the title to see its age rating for your country, its runtime and the trailer before you start.",
      },
    ],
  ),
  random(
    "animated",
    "animated movie or show",
    { type: "animation" },
    [
      "From Pixar and Studio Ghibli to adult animated series: spin for a random animated movie or show with good ratings.",
      "Each spin can land on a movie or a series, and the card tells you which.",
    ],
    [HOW_IT_WORKS],
  ),
  random(
    "documentary",
    "documentary",
    { type: "any", genres: ["documentary"] },
    [
      "In the mood to learn something? Spin for a random documentary film or docuseries, from true crime to nature and history, rated well by viewers.",
      "Docuseries show their number of seasons, so you can tell a one-night watch from a longer one.",
    ],
    [HOW_IT_WORKS],
  ),
  random(
    "comedy-show",
    "comedy show",
    { type: "series", genres: ["comedy"] },
    [
      "Need a sitcom to put on? Spin for a random comedy series with good ratings, from classic sitcoms to new shows.",
      "Great when you want something easy to watch in short episodes.",
    ],
    [HOW_IT_WORKS],
  ),
  random(
    "crime-show",
    "crime show",
    { type: "series", genres: ["crime"] },
    [
      "Detectives, heists, true crime and gangsters: spin for a random crime series that viewers rated well.",
      "Each show lists its seasons and where it's streaming in your country.",
    ],
    [HOW_IT_WORKS],
  ),
  random(
    "mystery-movie",
    "mystery movie",
    { type: "movie", genres: ["mystery"] },
    [
      "Love a whodunit? Spin for a random mystery movie, from classic detective stories to modern puzzle-box films, with good ratings only.",
      "No spoilers: each pick shows a short summary and the trailer.",
    ],
    [HOW_IT_WORKS],
  ),
];

const streaming = (
  slug: string,
  service: string,
  serviceKey: string,
  listRegion: string,
  intro: string[],
  onlyIn?: { region: string; name: string },
): Landing => ({
  slug,
  section: "streaming",
  heading: `What to watch on ${service} tonight`,
  title: `What to watch on ${service}: random picks & popular titles`,
  description: `Can't decide what to watch on ${service}? Spin for a random, well-rated movie or series streaming on ${service} in your country, with the trailer and ratings.`,
  linkLabel: service,
  intro,
  filters: { type: "any", minRating: MIN_RATING, services: [serviceKey] },
  spinLabel: `🎲 Spin something on ${service}`,
  gridHeading: `Popular on ${service}${listRegion === "CA" ? " in Canada" : " in the US"}`,
  listRegion,
  spinRegion: onlyIn?.region,
  faq: [
    {
      q: `Is everything here included with ${service}?`,
      a: `Spins only pick titles that stream on ${service} with your subscription in your country, not ones you'd have to rent or buy. Availability data comes from JustWatch and can lag a little behind ${service} itself.`,
    },
    onlyIn
      ? {
          q: `Is ${service} available outside ${onlyIn.name}?`,
          a: `No, ${service} is only in ${onlyIn.name}, so spins here always use what's streaming there.`,
        }
      : {
          q: "Does it work outside the US?",
          a: "Yes. The spin uses your country (from your browser, or your profile when you're logged in), so it only picks what's available where you are.",
        },
    HOW_IT_WORKS,
  ],
});

export const STREAMING_PAGES: Landing[] = [
  streaming("netflix", "Netflix", "netflix", "US", [
    "Netflix has thousands of titles and a home screen that changes every day, which is why choosing takes so long. Spin for one well-rated movie or series that's on Netflix in your country right now.",
    "Want just movies, or just a genre? Open the Spin page, choose Netflix under Streaming on, and add any filters you like.",
  ]),
  streaming("amazon-prime-video", "Prime Video", "amazon-prime-video", "US", [
    "Prime Video mixes what's included with your membership and what costs extra. Spins here only pick titles included with Prime in your country, so you won't land on a rental.",
    "Each pick shows the trailer, IMDb rating and runtime.",
  ]),
  streaming("disney-plus", "Disney+", "disney-plus", "US", [
    "Marvel, Star Wars, Pixar, National Geographic and decades of Disney classics: spin for one well-rated title on Disney+ in your country.",
    "Great for family nights: spins show the age rating on each title page.",
  ]),
  streaming("hulu", "Hulu", "hulu", "US", [
    "Hulu's mix of current TV, originals and movies makes for a lot of scrolling. Spin for one well-rated movie or series that's streaming on Hulu now.",
    "Hulu is US-only, so outside the US your spin will tell you there's nothing to pick.",
  ]),
  streaming("hbo-max", "HBO Max", "hbo-max", "US", [
    "HBO series, Warner Bros. movies and more: spin for a random, well-rated title streaming on HBO Max in your country.",
    "Each pick shows the trailer and how many seasons a series has.",
  ]),
  streaming("apple-tv", "Apple TV+", "apple-tv", "US", [
    "Apple TV+ has a smaller catalogue of originals that's easy to overlook. Spin for one of its well-rated movies or series.",
    "Each pick shows the trailer, rating and where else it's streaming.",
  ]),
  streaming("paramount-plus", "Paramount+", "paramount-plus", "US", [
    "From Star Trek and Yellowstone spin-offs to Paramount movies: spin for a well-rated title on Paramount+ in your country.",
    "Spin again as often as you like; picks don't repeat during your visit.",
  ]),
  streaming("peacock", "Peacock", "peacock", "US", [
    "Peacock has NBC shows, Universal movies and originals. Spin for one well-rated movie or series that's on Peacock right now.",
    "Peacock is US-only, so outside the US your spin will tell you there's nothing to pick.",
  ]),
  streaming("crave", "Crave", "crave", "CA", [
    "Crave is Canada's home of HBO series, plus movies and Canadian originals. Spin for a random, well-rated title streaming on Crave.",
    "Crave is only in Canada, so spins here use Canadian availability.",
  ], { region: "CA", name: "Canada" }),
];

export const LANDING_PAGES = [...RANDOM_PAGES, ...STREAMING_PAGES];

export const landingPath = (l: Landing) => `/${l.section}/${l.slug}`;

export function findLanding(section: Landing["section"], slug: string) {
  return LANDING_PAGES.find((l) => l.section === section && l.slug === slug);
}
