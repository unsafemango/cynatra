import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Credits",
  alternates: { canonical: "/credits" },
  description: "Where Cynatra's movie and series data comes from.",
};

// TMDB's and IMDb's terms require these notices; TMDB allows them on a credits page.
export default function CreditsPage() {
  return (
    <LegalPage
      title="Credits"
      intro={<p>Cynatra is built on data from these services. Thank you to them.</p>}
      sections={[
        {
          heading: "TMDB",
          body: (
            <p className="flex flex-wrap items-center gap-x-2">
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noreferrer"
                className="font-semibold !text-[#01b4e4] !no-underline"
              >
                TMDB
              </a>
              This product uses the TMDB API but is not endorsed or certified by TMDB. Titles, posters, cast and
              trailers come from The Movie Database.
            </p>
          ),
        },
        {
          heading: "JustWatch",
          body: (
            <p>
              Streaming data by{" "}
              <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
                JustWatch
              </a>
              , provided through TMDB.
            </p>
          ),
        },
        {
          heading: "IMDb",
          body: (
            <p>
              IMDb ratings: information courtesy of{" "}
              <a href="https://www.imdb.com" target="_blank" rel="noreferrer">
                IMDb (https://www.imdb.com)
              </a>
              . Used with permission.
            </p>
          ),
        },
        {
          heading: "YouTube",
          body: <p>Trailers are played from YouTube.</p>,
        },
      ]}
    />
  );
}
