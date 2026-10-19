import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

// Makes Cynatra installable ("Add to Home Screen"): opens full-screen like an
// app, with its own icon and name. /install explains how on each device.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cynatra: what to watch tonight",
    short_name: "Cynatra",
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The dark theme's background: the splash screen while the app opens.
    background_color: "#0b0a10",
    theme_color: "#0b0a10",
    categories: ["entertainment", "lifestyle"],
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Spin now", short_name: "Spin", url: "/?spin=1" },
      { name: "Discover", url: "/discover" },
      { name: "Your library", short_name: "Library", url: "/library" },
    ],
  };
}
