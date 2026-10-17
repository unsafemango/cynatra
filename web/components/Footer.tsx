import Link from "next/link";
import { Logo } from "./Logo";
import { RatingSourcePicker } from "./RatingSourcePicker";
import { ThemePicker } from "./ThemeControls";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { href: "/", label: "Spin" },
      { href: "/search", label: "Search" },
      { href: "/shortlist", label: "Shortlist" },
      { href: "/library", label: "Library" },
      { href: "/services", label: "Streaming services" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/help", label: "Help & FAQ" },
      { href: "/help#contact", label: "Contact support" },
      { href: "/profile", label: "Your profile" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      // TMDB and IMDb require their attribution; TMDB allows it on a credits page.
      { href: "/credits", label: "Credits" },
    ],
  },
];

/**
 * Site footer: what Cynatra is, links grouped by what you're after, and the
 * two display settings (theme, rating source) people look for at the bottom.
 */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-border/60 bg-surface/40">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-10 sm:grid-cols-3 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-3 md:col-span-1">
          <Link href="/" aria-label="Cynatra home" className="inline-block rounded-lg">
            <Logo size={26} />
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Stop scrolling, start watching. One good pick for tonight, in a single spin.
          </p>
          <Link
            href="/?spin=1"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.98]"
          >
            🎲 Spin now
          </Link>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{col.title}</h2>
            <ul className="mt-3 space-y-1">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex py-1 text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border/60">
        {/* Extra right padding keeps the settings clear of the floating "back to top" button. */}
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pb-20 pt-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-5 sm:pr-20">
          <p>Free to use · No ads · No tracking</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <label htmlFor="footer-theme" className="flex items-center gap-2">
              Theme
              <ThemePicker id="footer-theme" size="sm" />
            </label>
            <label htmlFor="footer-rating" className="flex items-center gap-2">
              Ratings
              <RatingSourcePicker id="footer-rating" size="sm" />
            </label>
          </div>
        </div>
      </div>
    </footer>
  );
}
