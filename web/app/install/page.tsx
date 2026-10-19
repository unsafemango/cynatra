import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";
import { InstallGuide } from "./InstallGuide";

export const metadata: Metadata = {
  title: "Install the app",
  description:
    "Put Cynatra on your phone's home screen or your computer: it opens full-screen like an app. Free, no app store needed.",
  alternates: { canonical: "/install" },
};

const PERKS = [
  ["One tap away", "Open it from your home screen, like any app."],
  ["Full screen", "No browser bars, just Cynatra."],
  ["Always up to date", "New features arrive by themselves, nothing to update."],
  ["Free and tiny", "No app store, no account needed, almost no storage."],
];

export default function InstallPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 text-center sm:p-10">
        <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <LogoMark size={72} className="mx-auto block drop-shadow-xl" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Get the Cynatra app</h1>
          <p className="mx-auto mt-3 max-w-md text-[17px] leading-relaxed text-foreground/85">
            Add Cynatra to your phone&apos;s home screen or your computer. It opens full-screen, like an app, with no
            app store needed.
          </p>
        </div>
      </header>

      <InstallGuide />

      <ul className="grid gap-3 sm:grid-cols-2">
        {PERKS.map(([title, body]) => (
          <li key={title} className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-medium">{title}</p>
            <p className="mt-0.5 text-sm text-muted">{body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
