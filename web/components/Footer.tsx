import { LogoMark } from "./Logo";
import { RatingSourcePicker } from "./RatingSourcePicker";

export function Footer() {
  return (
    <footer className="border-t border-border/60 text-xs text-muted">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <p className="flex items-center gap-2">
          <LogoMark size={16} />
          Cynatra — stop scrolling, start watching.
        </p>
        <label htmlFor="footer-rating" className="flex items-center gap-2">
          Ratings from
          <RatingSourcePicker id="footer-rating" />
        </label>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-6 space-y-1.5">
        {/* TMDB and IMDb attributions are required by their terms. */}
        <p className="flex items-center gap-2">
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#01b4e4]"
          >
            TMDB
          </a>
          This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming data by JustWatch.
        </p>
        <p>
          IMDb ratings: information courtesy of{" "}
          <a href="https://www.imdb.com" target="_blank" rel="noreferrer" className="hover:underline">
            IMDb (https://www.imdb.com)
          </a>
          . Used with permission.
        </p>
      </div>
    </footer>
  );
}
