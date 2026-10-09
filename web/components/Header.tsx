"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Logo } from "./Logo";

export function Header() {
  const { user, ready, logout } = useAuth();
  return (
    <header className="border-b border-border/60 bg-background/70 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" aria-label="Cynatra home" className="whitespace-nowrap shrink-0 rounded-md">
          <Logo size={26} />
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1 text-sm whitespace-nowrap">
          <Link href="/" className="px-2 sm:px-3 py-1.5 rounded-md text-muted hover:text-foreground">
            Spin
          </Link>
          {ready && user && (
            <>
              <Link href="/library" className="px-2 sm:px-3 py-1.5 rounded-md text-muted hover:text-foreground">
                Library
              </Link>
              <Link href="/profile" className="px-2 sm:px-3 py-1.5 rounded-md text-muted hover:text-foreground">
                Profile
              </Link>
              <button onClick={logout} className="px-2 sm:px-3 py-1.5 rounded-md text-muted hover:text-foreground">
                Log out
              </button>
            </>
          )}
          {ready && !user && (
            <>
              <Link href="/login" className="px-2 sm:px-3 py-1.5 rounded-md text-muted hover:text-foreground">
                Log in
              </Link>
              <Link
                href="/register"
                className="ml-1 px-3 py-1.5 rounded-md bg-accent text-white font-medium hover:brightness-110"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
