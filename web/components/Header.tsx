"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { loginHref } from "@/lib/after-login";
import { useShortlist } from "@/lib/shortlist";
import { SearchIcon } from "./icons";
import { ThemeToggle } from "./ThemeControls";
import { Logo, LogoMark } from "./Logo";

export function Header() {
  return (
    // Padded for the notch when installed on an iPhone (the status bar sits over the page).
    <header className="border-b border-border/60 bg-background/70 backdrop-blur sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" aria-label="Cynatra home" className="whitespace-nowrap shrink-0 rounded-md">
          {/* Phones: just the mark, so Spin · Library · Shortlist · account all fit. */}
          <LogoMark size={30} className="sm:hidden" />
          <span className="hidden sm:inline-flex">
            <Logo size={26} />
          </span>
        </Link>
        {/* The nav reads the current path (request-time on dynamic routes). */}
        <Suspense fallback={<NavPlaceholder />}>
          <Nav />
        </Suspense>
      </div>
    </header>
  );
}

function Nav() {
  const { user, ready } = useAuth();
  const { items, loaded } = useShortlist();
  const pathname = usePathname();

  if (!ready) return <NavPlaceholder />;

  const shortlist = (
    <NavLink href="/shortlist" current={pathname === "/shortlist"}>
      Shortlist
      {loaded && items.length > 0 && (
        <span
          className="ml-1.5 inline-grid min-w-5 h-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white tabular-nums"
          aria-label={`${items.length} in shortlist`}
        >
          {items.length}
        </span>
      )}
    </NavLink>
  );

  return (
    <nav aria-label="Main" className="flex items-center gap-1 text-sm whitespace-nowrap">
      {/* Laptops: one-click light/dark. Phones have it in the footer (no room here). */}
      <ThemeToggle className="hidden sm:grid" />
      <NavLink href="/search" current={pathname === "/search"} label="Search">
        <SearchIcon width={16} height={16} />
        {/* Phones: icon only, so the rest of the nav still fits. */}
        <span className="hidden sm:inline ml-1.5">Search</span>
      </NavLink>
      <NavLink href="/" current={pathname === "/"}>
        Spin
      </NavLink>
      {user ? (
        <>
          <NavLink href="/library" current={pathname.startsWith("/library")}>
            Library
          </NavLink>
          {shortlist}
          <AccountMenu email={user.email} />
        </>
      ) : (
        <>
          {shortlist}
          {/* Phones: no room; the Sign up page has a Log in tab. */}
          <span className="hidden sm:contents">
            <NavLink href={loginHref(pathname)} current={pathname === "/login"}>
              Log in
            </NavLink>
          </span>
          <Link
            href={loginHref(pathname, "register")}
            className="ml-1 px-3 py-1.5 rounded-lg bg-accent text-white font-medium hover:brightness-110"
          >
            Sign up
          </Link>
        </>
      )}
    </nav>
  );
}

function NavLink({
  href,
  current,
  label,
  children,
}: {
  href: string;
  current: boolean;
  /** Accessible name, when the visible text can be hidden. */
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={`inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors ${
        current ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground hover:bg-surface/80"
      }`}
    >
      {children}
    </Link>
  );
}

/** Keeps the bar from jumping while we find out whether you're logged in. */
function NavPlaceholder() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="h-7 w-12 rounded-lg bg-surface-2/70 animate-pulse" />
      <span className="h-7 w-14 rounded-lg bg-surface-2/70 animate-pulse" />
      <span className="size-8 rounded-full bg-surface-2/70 animate-pulse" />
    </div>
  );
}

/** Round initial button that opens a small account menu. */
function AccountMenu({ email }: { email: string }) {
  const { logout } = useAuth();
  const pathname = usePathname();
  // The page the menu was opened on: it only shows there.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (o: boolean) => setOpenOn(o ? pathname : null);

  // Any navigation closes it for good, so coming Back to that page doesn't
  // find it still open.
  useEffect(() => {
    setOpenOn(null); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initial = email.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpenOn(null);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative ml-1">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email}`}
        className={`flex items-center gap-1.5 rounded-full p-0.5 sm:pr-2 transition-colors ${
          open || pathname === "/profile" ? "bg-surface-2" : "hover:bg-surface-2"
        }`}
      >
        <span className="grid size-8 place-items-center rounded-full bg-accent/20 text-accent font-semibold ring-1 ring-accent/40">
          {initial}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          className={`hidden sm:block text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/20 text-accent font-semibold">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted">Signed in as</p>
              <p className="truncate text-sm font-medium" title={email}>
                {email}
              </p>
            </div>
          </div>
          <div className="p-1.5">
            <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className={menuItem}>
              Profile &amp; settings
            </Link>
            <Link href="/library" role="menuitem" onClick={() => setOpen(false)} className={menuItem}>
              My library
            </Link>
            <Link href="/services" role="menuitem" onClick={() => setOpen(false)} className={menuItem}>
              My streaming services
            </Link>
            <Link href="/help" role="menuitem" onClick={() => setOpen(false)} className={menuItem}>
              Help &amp; support
            </Link>
          </div>
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className={`${menuItem} text-accent`}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const menuItem =
  "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none";
