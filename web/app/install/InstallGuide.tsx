"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { canPromptInstall, isInstalled, onInstallChange, promptInstall } from "@/lib/install";

type Device = "iphone" | "android" | "mac-safari" | "desktop";

/** Which instructions to lead with, from the browser's user agent. */
function detectDevice(): Device {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iphone";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "mac-safari";
  return "desktop";
}

const STEPS: Record<Device, { title: string; steps: React.ReactNode[] }> = {
  iphone: {
    title: "iPhone and iPad",
    steps: [
      <>
        Open <strong>cynatra.app</strong> in Safari (or Chrome).
      </>,
      <>
        Tap the <strong>Share</strong> button <ShareIcon /> (at the bottom in Safari, top right in Chrome).
      </>,
      <>
        Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
      </>,
    ],
  },
  android: {
    title: "Android",
    steps: [
      <>
        Open <strong>cynatra.app</strong> in Chrome.
      </>,
      <>
        Tap the <strong>⋮</strong> menu (top right).
      </>,
      <>
        Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>), then <strong>Install</strong>.
      </>,
    ],
  },
  "mac-safari": {
    title: "Mac (Safari)",
    steps: [
      <>
        Open <strong>cynatra.app</strong> in Safari.
      </>,
      <>
        In the menu bar, choose <strong>File → Add to Dock</strong>.
      </>,
      <>
        Click <strong>Add</strong>. Cynatra opens in its own window from the Dock.
      </>,
    ],
  },
  desktop: {
    title: "Computer (Chrome or Edge)",
    steps: [
      <>
        Open <strong>cynatra.app</strong> in Chrome or Edge.
      </>,
      <>
        Click the <strong>install</strong> icon at the right end of the address bar (a screen with a down arrow).
      </>,
      <>
        Click <strong>Install</strong>. Cynatra opens in its own window, like any app.
      </>,
    ],
  },
};

/**
 * How to install Cynatra on this device: a one-click button where the browser
 * allows it (Chrome, Edge, Android), steps everywhere else (iPhone Safari has
 * no install button), and the other devices' steps underneath.
 */
export function InstallGuide() {
  const [device, setDevice] = useState<Device | null>(null);
  const [installed, setInstalled] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const canPrompt = useSyncExternalStore(onInstallChange, canPromptInstall, () => false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDevice(detectDevice());
    setInstalled(isInstalled());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const install = async () => {
    if (await promptInstall()) setJustInstalled(true);
  };

  if (installed || justInstalled) {
    return (
      <div role="status" className="rounded-2xl border border-success/40 bg-success/10 p-5 text-center">
        <p className="text-lg font-medium">✓ {justInstalled ? "Installed!" : "You're using the app"}</p>
        <p className="mt-1 text-muted">
          {justInstalled ? "Find Cynatra on your home screen or in your apps." : "Cynatra is installed on this device."}
        </p>
      </div>
    );
  }

  // Until the device is known (and on the server), lead with the iPhone steps.
  const primary = device ?? "iphone";
  const others = (Object.keys(STEPS) as Device[]).filter((d) => d !== primary);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        {canPrompt ? (
          <>
            <p className="font-medium">Install with one tap</p>
            <p className="mt-1 text-sm text-muted">Your browser can install Cynatra directly.</p>
            <button
              onClick={install}
              className="mt-4 w-full rounded-xl bg-accent px-5 py-3 font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.98] sm:w-auto"
            >
              Install Cynatra
            </button>
          </>
        ) : (
          <Steps title={`On your ${STEPS[primary].title.split(" (")[0]}`} steps={STEPS[primary].steps} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Other devices</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {others.map((d) => (
            <div key={d} className="rounded-2xl border border-border bg-surface p-4">
              <Steps title={STEPS[d].title} steps={STEPS[d].steps} small />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Steps({ title, steps, small = false }: { title: string; steps: React.ReactNode[]; small?: boolean }) {
  return (
    <>
      <p className={small ? "text-sm font-semibold" : "font-medium"}>{title}</p>
      <ol className={`mt-3 space-y-2.5 ${small ? "text-sm" : ""}`}>
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              className={`grid shrink-0 place-items-center rounded-full bg-accent/15 font-semibold text-accent ${
                small ? "size-5 text-xs" : "size-6 text-sm"
              }`}
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="text-foreground/90">{s}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** iOS's Share icon (a box with an arrow up), so it's easy to spot. */
function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block -translate-y-px text-accent"
      aria-label="Share"
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
