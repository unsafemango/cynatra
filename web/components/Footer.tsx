import Link from "next/link";
import { LogoMark } from "./Logo";
import { RatingSourcePicker } from "./RatingSourcePicker";
import { ThemePicker } from "./ThemeControls";

export function Footer() {
  return (
    <footer className="border-t border-border/60 text-xs text-muted">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <p className="flex items-center gap-2">
          <LogoMark size={16} />
          Cynatra — stop scrolling, start watching.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/help" className="hover:text-foreground hover:underline underline-offset-4">
            Help &amp; FAQ
          </Link>
          <Link href="/help#contact" className="hover:text-foreground hover:underline underline-offset-4">
            Contact support
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline underline-offset-4">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline underline-offset-4">
            Terms
          </Link>
          {/* TMDB and IMDb require their attribution; TMDB allows it on a credits page. */}
          <Link href="/credits" className="hover:text-foreground hover:underline underline-offset-4">
            Credits
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label htmlFor="footer-theme" className="flex items-center gap-2">
            Theme
            <ThemePicker id="footer-theme" size="sm" />
          </label>
          <label htmlFor="footer-rating" className="flex items-center gap-2">
            Ratings from
            <RatingSourcePicker id="footer-rating" size="sm" />
          </label>
        </div>
      </div>
    </footer>
  );
}
