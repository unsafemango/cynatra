import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
// The gateway, when it's on another origin (local development); "" in production
// (same domain, /api routed to it), which 'self' already covers.
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : "";

// What pages may load, beyond Cynatra itself: Google's sign-in button and
// YouTube trailers. Images (TMDB posters, logos) come through Next's own
// /_next/image. Inline scripts are allowed because Next.js and the theme
// script use them; external scripts are not.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://accounts.google.com/gsi/client`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob: https://image.tmdb.org https://*.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://accounts.google.com/gsi/${dev ? " ws: wss:" : ""}`.replace(/  +/g, " "),
  "frame-src https://accounts.google.com https://www.youtube-nocookie.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // HTTPS only, for a year (browsers ignore this on plain-http localhost).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No embedding Cynatra in other sites' frames (clickjacking); CSP frame-ancestors too.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // Self-contained server build (.next/standalone) for the Docker image.
  output: "standalone",
  cacheComponents: true,
  // Security headers on every page, and the service worker (offline page)
  // always fetched fresh, so updates reach installed apps straight away.
  // Don't advertise the server software.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  // Crawlers that get the page's <title>, description and canonical link in
  // <head> before any content (instead of streamed in later): Next's default
  // list plus Googlebot, so Google never has to find them in the body.
  htmlLimitedBots:
    /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  partialPrefetching: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
