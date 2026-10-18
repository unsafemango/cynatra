import type { Metadata } from "next";

// The page itself is a client component; its metadata lives here.
export const metadata: Metadata = {
  title: "Your library",
  description: "Your watchlist, what you're watching, and what you've seen.",
  // Personal to each visitor, so not for search results.
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
