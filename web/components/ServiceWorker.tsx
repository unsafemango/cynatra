"use client";

import { useEffect } from "react";
import { watchInstallPrompt } from "@/lib/install";

/**
 * Registers public/sw.js (production only), which shows a friendly offline
 * page when the installed app or site is opened without a connection, and
 * keeps the browser's "can be installed" announcement for /install.
 */
export function ServiceWorker() {
  useEffect(() => watchInstallPrompt(), []);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not essential: everything works without it, just no offline page.
    });
  }, []);
  return null;
}
