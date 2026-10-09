"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// In-app history, kept in memory so we only call router.back() when the
// previous page is part of Cynatra. Someone opening a shared /t/... link
// directly has no in-app history, so Back sends them to the spin page instead
// of out of the site.
const stack: string[] = [];

function track(path: string) {
  if (stack[stack.length - 1] === path) return;
  if (stack[stack.length - 2] === path) stack.pop(); // went back
  else stack.push(path);
}

/** Back link shown above every page except the spin page. */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    track(pathname);
  }, [pathname]);

  if (pathname === "/") return null;

  return (
    <Link
      href="/"
      onClick={(e) => {
        // Plain href="/" still works without JS and for new-tab clicks.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (stack.length > 1 && stack[stack.length - 1] === pathname) {
          e.preventDefault();
          router.back();
        }
      }}
      className="group mb-6 inline-flex items-center gap-1.5 -ml-2 px-2 py-1 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface transition-colors"
    >
      <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
        ←
      </span>
      Back
    </Link>
  );
}
