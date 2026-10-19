"use client";

// Chrome, Edge and Android announce once per page load that Cynatra can be
// installed (beforeinstallprompt), usually before the visitor reaches /install.
// It's kept here so the Install button can use it later. Safari never sends it:
// iPhones install from the Share menu instead.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let watching = false;

/** Starts listening (once, from the root layout). */
export function watchInstallPrompt() {
  if (watching) return;
  watching = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we offer it on /install rather than at a random moment
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export const canPromptInstall = () => deferred !== null;

/** Shows the browser's install dialog; true if the visitor installed. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null; // each announcement can only be used once
  await e.prompt();
  const { outcome } = await e.userChoice;
  notify();
  return outcome === "accepted";
}

export function onInstallChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Already running as the installed app (from the home screen). */
export function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
