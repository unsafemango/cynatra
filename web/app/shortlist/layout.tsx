import type { Metadata } from "next";

// The page itself is a client component; its metadata lives here.
export const metadata: Metadata = {
  title: "Shortlist",
  description: "Can't choose between a few titles? Add them here and let Cynatra pick one.",
  // Personal to each visitor, so not for search results.
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
