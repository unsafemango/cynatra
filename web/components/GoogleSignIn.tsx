"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typing for Google Identity Services (https://developers.google.com/identity/gsi/web).
type CredentialResponse = { credential: string };
type GoogleId = {
  initialize: (opts: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, string | number>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let scriptLoad: Promise<void> | null = null;

/** Loads Google's sign-in script once per page load. */
function loadGoogleScript() {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoad = null; // allow a retry on the next visit
      reject(new Error("Couldn't load Google sign-in."));
    };
    document.head.appendChild(s);
  });
  return scriptLoad;
}

/**
 * Google's official "Continue with Google" button. Calls `onCredential` with
 * the ID token Google returns; the gateway verifies it. `onPopupClosed` fires
 * as soon as Google's sign-in popup closes, before Google hands over the
 * result (which can take a moment), so the page can show progress right away.
 */
export function GoogleSignIn({
  clientId,
  onCredential,
  onError,
  onPopupClosed,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  onPopupClosed?: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  // "shown" once Google's button actually has a size; Google draws nothing for an
  // unknown client ID or an origin that isn't on the client's allowed list.
  const [status, setStatus] = useState<"loading" | "shown" | "unavailable">("loading");
  // Google keeps the callback from initialize(); route it to the latest props.
  const handlers = useRef({ onCredential, onError, onPopupClosed });
  useEffect(() => {
    handlers.current = { onCredential, onError, onPopupClosed };
  });

  // Clicking Google's button focuses its iframe (our window blurs), then the
  // popup takes focus. When it closes, focus comes back to this window: that's
  // the moment to report, whether or not an account was picked. The window's
  // focus event is instant; polling document.hasFocus() is a backup.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let popupHadFocus = false;
    let watching = false;
    const report = () => {
      if (!watching || !popupHadFocus) return;
      watching = false;
      clearInterval(timer);
      handlers.current.onPopupClosed?.();
    };
    const onBlur = () => {
      const active = document.activeElement;
      if (active instanceof HTMLIFrameElement && slot.current?.contains(active)) {
        // Focus moved into Google's button: a popup is about to open.
        watching = true;
        popupHadFocus = false;
        const started = Date.now();
        clearInterval(timer);
        timer = setInterval(() => {
          if (!document.hasFocus()) popupHadFocus = true;
          else report();
          if (watching && !popupHadFocus && Date.now() - started > 3000) {
            watching = false; // no popup appeared (e.g. it was blocked)
            clearInterval(timer);
          }
        }, 100);
      } else if (watching) {
        popupHadFocus = true; // focus left the page for the popup
      }
    };
    // Only counts once the popup was seen holding focus (so clicking back
    // into the page after a blocked popup doesn't look like a sign-in).
    const onFocus = () => report();
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const el = slot.current;
        const gid = window.google?.accounts.id;
        if (cancelled || !el || !gid) return;
        gid.initialize({
          client_id: clientId,
          callback: (r) => handlers.current.onCredential(r.credential),
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        gid.renderButton(el, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          // Google's button takes a pixel width between 200 and 400.
          width: Math.max(200, Math.min(400, el.offsetWidth || 320)),
        });
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    // Keep watching even after "unavailable": a slow button can still show up.
    const observer = new ResizeObserver(() => {
      if (el.offsetHeight > 0) {
        setStatus("shown");
        observer.disconnect();
      }
    });
    observer.observe(el);
    const timeout = setTimeout(() => {
      if (el.offsetHeight > 0) return;
      setStatus((s) => (s === "loading" ? "unavailable" : s));
      console.warn(
        `[cynatra] Google's sign-in button didn't render. Check that GOOGLE_CLIENT_ID is a Web client ID and that ${location.origin} is listed under its Authorized JavaScript origins.`,
      );
    }, 8000);
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [clientId]);

  return (
    <div className="relative min-h-11">
      {status === "loading" && (
        <div className="absolute inset-0 rounded-full bg-surface-2 animate-pulse" aria-label="Loading Google sign-in" />
      )}
      {status === "unavailable" && (
        <p className="absolute inset-0 grid place-items-center text-sm text-muted text-center">
          Google sign-in isn&apos;t available right now. Use email below.
        </p>
      )}
      <div ref={slot} className="flex justify-center [color-scheme:normal]" />
    </div>
  );
}
