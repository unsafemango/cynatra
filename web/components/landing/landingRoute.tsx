import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findLanding, landingPath, type Landing } from "@/lib/landing";
import { LandingView } from "./LandingView";

type Params = Promise<{ slug: string }>;

/**
 * The metadata and page for /random/[slug] and /streaming/[slug]. Rendered per
 * request (the popular list comes from the API and is cached for hours), never
 * at build time, when the API isn't there.
 */
export function landingRoute(section: Landing["section"]) {
  async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const page = findLanding(section, (await params).slug);
    // Here rather than in the page, so the response is a real 404 (the page streams).
    if (!page) notFound();
    return {
      title: page.title,
      description: page.description,
      alternates: { canonical: landingPath(page) },
      openGraph: { title: page.heading, description: page.description, url: landingPath(page) },
    };
  }

  function Page({ params }: { params: Params }) {
    return (
      <Suspense fallback={<div className="mx-auto h-[420px] max-w-5xl rounded-2xl bg-surface animate-pulse" />}>
        <Content params={params} />
      </Suspense>
    );
  }

  async function Content({ params }: { params: Params }) {
    const page = findLanding(section, (await params).slug);
    if (!page) notFound();
    return <LandingView page={page} />;
  }

  return { generateMetadata, Page };
}
