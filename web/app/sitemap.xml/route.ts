import { sitemapIndex, xmlResponse } from "@/lib/sitemaps";

// The sitemap index: lists /sitemaps/pages.xml, titles.xml and people.xml.
export function GET() {
  return xmlResponse(sitemapIndex());
}
