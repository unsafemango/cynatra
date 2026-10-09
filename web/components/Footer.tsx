export function Footer() {
  return (
    <footer className="border-t border-border/60 text-xs text-muted">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <p>Cynatra — stop scrolling, start watching.</p>
        {/* TMDB attribution is required by their API terms. */}
        <p className="flex items-center gap-2">
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="font-semibold text-[#01b4e4]">
            TMDB
          </a>
          This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming data by JustWatch.
        </p>
      </div>
    </footer>
  );
}
