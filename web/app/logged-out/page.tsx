"use client";

import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth";

// Where "Log out" lands: a clear confirmation and a way straight back in.
export default function LoggedOutPage() {
  const { user, ready } = useAuth();

  // Opened while still signed in (e.g. an old tab or a typed URL).
  if (ready && user) {
    return (
      <div className="max-w-md mx-auto pt-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re still logged in</h1>
        <p className="mt-2 text-muted">as {user.email}</p>
        <Link
          href="/"
          className="mt-6 inline-flex px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:brightness-110"
        >
          Go to Cynatra
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pt-6 sm:pt-12">
      <div className="rounded-3xl border border-border bg-surface px-6 py-10 sm:px-10 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-success/15 text-success ring-8 ring-success/5">
          <CheckIcon width={30} height={30} strokeWidth={2.4} />
        </div>
        <h1 role="status" className="text-2xl font-semibold tracking-tight">
          You&apos;ve logged out successfully
        </h1>
        <p className="mt-2 text-muted">You can log in again using the button below.</p>

        <Link
          href="/login"
          className="mt-8 flex w-full items-center justify-center rounded-xl bg-accent py-3 font-semibold text-white shadow-lg shadow-accent/25 hover:brightness-110 active:scale-[0.99] transition"
        >
          Log in
        </Link>
        <Link
          href="/"
          className="mt-3 flex w-full items-center justify-center rounded-xl border border-border py-3 text-sm text-muted hover:text-foreground hover:border-muted transition-colors"
        >
          Keep browsing without an account
        </Link>
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        On a shared computer? You&apos;re fully signed out of Cynatra on this browser.
      </p>
    </div>
  );
}
