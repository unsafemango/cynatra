import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "./SearchView";

export const metadata: Metadata = {
  title: "Search movies & series",
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  // The query comes from the URL (request-time data), so the view renders inside Suspense.
  return (
    <Suspense
      fallback={<div className="mx-auto h-14 max-w-2xl rounded-2xl border border-border bg-surface animate-pulse" />}
    >
      <SearchView />
    </Suspense>
  );
}
