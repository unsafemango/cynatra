import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { BackButton } from "@/components/BackButton";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ServiceWorker } from "@/components/ServiceWorker";
import { AuthProvider } from "@/lib/auth";
import { ShortlistProvider } from "@/lib/shortlist";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: what to watch tonight, in one spin`,
    // Pages set their own title; the site name follows it.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  // Installed on an iPhone home screen: full-screen, named Cynatra, with the
  // status bar over the page (the header leaves room for it).
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  // Draw under the notch and home bar; the header and floating buttons pad for them.
  viewportFit: "cover",
  // Browser and installed-app chrome match the page (system light/dark).
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0a10" },
    { media: "(prefers-color-scheme: light)", color: "#f6f5fa" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme script below may set data-theme before React loads.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a saved light/dark choice before the first paint, so it never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ShortlistProvider>
            <Header />
            {/* At least a screen tall, so content arriving late never shoves a visible footer down. */}
            <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 min-h-[calc(100dvh-3.5rem)]">
              {/* Reads the pathname, which is request-time data on dynamic routes. */}
              <Suspense fallback={null}>
                <BackButton />
              </Suspense>
              {children}
            </main>
            <Footer />
            <ScrollToTop />
            <ServiceWorker />
          </ShortlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
