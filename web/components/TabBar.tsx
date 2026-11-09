"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShortlist } from "@/lib/shortlist";
import { BookmarkIcon, CompassIcon, DiceIcon, LibraryIcon, SearchIcon } from "./icons";

const TABS = [
  { href: "/", label: "Spin", Icon: DiceIcon, match: (p: string) => p === "/" },
  {
    href: "/discover",
    label: "Discover",
    Icon: CompassIcon,
    // The genre and streaming pages are reached from Discover.
    match: (p: string) => p === "/discover" || p.startsWith("/random/") || p.startsWith("/streaming/"),
  },
  { href: "/search", label: "Search", Icon: SearchIcon, match: (p: string) => p === "/search" },
  { href: "/shortlist", label: "Shortlist", Icon: BookmarkIcon, match: (p: string) => p === "/shortlist" },
  { href: "/library", label: "Library", Icon: LibraryIcon, match: (p: string) => p.startsWith("/library") },
];

/**
 * Phones: the main pages as a tab bar along the bottom of the screen, where
 * thumbs reach (like most phone apps). Wider screens use the header instead.
 * Its height is --tabbar-h (globals.css); the page is padded by it.
 */
export function TabBar() {
  const pathname = usePathname();
  const { items, loaded } = useShortlist();

  return (
    <nav
      id="tab-bar"
      aria-label="Tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg sm:hidden"
    >
      <ul className="grid h-14 grid-cols-5">
        {TABS.map(({ href, label, Icon, match }) => {
          const current = match(pathname);
          const count = href === "/shortlist" && loaded ? items.length : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:scale-95 ${
                  current ? "text-accent" : "text-muted"
                }`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${current ? "bg-accent/15" : ""}`}
                >
                  <Icon width={21} height={21} strokeWidth={current ? 2.1 : 1.8} />
                </span>
                {label}
                {count > 0 && (
                  <span
                    className="absolute left-1/2 top-1 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white tabular-nums"
                    aria-label={`${count} in shortlist`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
