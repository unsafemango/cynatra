import { connection } from "next/server";
import { SITEMAPS, urlset, xmlResponse } from "@/lib/sitemaps";

// One of the sitemaps listed in /sitemap.xml, e.g. /sitemaps/titles.xml.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // Own keys only, so names like "toString" are a plain 404.
  if (!Object.hasOwn(SITEMAPS, name)) return new Response("Not found", { status: 404 });
  const build = SITEMAPS[name];
  // Built when requested (the lists come from the API), never at build time.
  await connection();
  return xmlResponse(urlset(await build()));
}
