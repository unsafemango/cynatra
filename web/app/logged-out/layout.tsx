import type { Metadata } from "next";

// The page itself is a client component; its metadata lives here.
export const metadata: Metadata = {
  title: "Logged out",
  // Personal to each visitor, so not for search results.
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
