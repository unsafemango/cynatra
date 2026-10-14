"use client";

import Link from "next/link";
import { RatingSourcePicker } from "@/components/RatingSourcePicker";
import { Select, type SelectOption } from "@/components/Select";
import { ThemePicker } from "@/components/ThemeControls";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { CheckIcon, ListIcon, PlayIcon, EyeCheckIcon, Spinner } from "@/components/icons";
import { LogoMark } from "@/components/Logo";
import { api, type User } from "@/lib/api";
import { flag, REGIONS } from "@/lib/regions";
import { useAuth } from "@/lib/auth";




const REGION_OPTIONS: SelectOption<string>[] = REGIONS.map(([code, name]) => ({
  value: code,
  label: name,
  icon: <span className="text-lg leading-none">{flag(code)}</span>,
  keywords: code,
}));

type Counts = { watchlist: number; watching: number; seen: number; history: number };
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export default function ProfilePage() {
  const { user, ready, setUser, logout } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // Fresh account details (sign-in methods, join date) and activity counts.
  // Effects re-run when this kept-alive page is shown again, so they stay current.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api<{ user: User }>("/api/auth/me")
      .then((r) => !cancelled && setUser(r.user))
      .catch(() => {});
    api<Counts>("/api/me/counts")
      .then((c) => !cancelled && setCounts(c))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // setUser is a stable state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Hide "Saved" a moment after it appears.
  useEffect(() => {
    if (save.kind !== "saved") return;
    const t = setTimeout(() => setSave({ kind: "idle" }), 2500);
    return () => clearTimeout(t);
  }, [save]);

  // Don't show an old status when coming back to this (kept-alive) page.
  useLayoutEffect(() => () => setSave({ kind: "idle" }), []);

  if (ready && !user) {
    return (
      <div className="max-w-md mx-auto pt-6 sm:pt-12">
        <div className="rounded-3xl border border-border bg-surface px-6 py-10 sm:px-10 text-center">
          <LogoMark size={52} className="block mx-auto mb-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Your profile lives here</h1>
          <p className="mt-2 text-muted">Log in to see your activity and choose your streaming country.</p>
          <div className="mt-8 grid gap-3">
            <Link href="/login" className={primaryBtn}>
              Log in
            </Link>
            <Link href="/register" className={secondaryBtn}>
              Create an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="max-w-2xl mx-auto h-64 rounded-3xl bg-surface border border-border animate-pulse" />;
  }

  const changeRegion = async (region: string) => {
    if (region === user.region) return;
    const previous = user;
    setUser({ ...user, region }); // show the new choice straight away
    setSave({ kind: "saving" });
    try {
      const r = await api<{ user: User }>("/api/auth/me", { method: "PATCH", body: JSON.stringify({ region }) });
      setUser(r.user);
      setSave({ kind: "saved" });
    } catch (e) {
      setUser(previous);
      setSave({ kind: "error", message: e instanceof Error ? e.message : "Couldn't save. Please try again." });
    }
  };

  const initial = user.email.charAt(0).toUpperCase();
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const methods = [user.hasGoogle && "Google", user.hasPassword && "Email & password"].filter(Boolean) as string[];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Account */}
      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-accent/20 text-2xl font-semibold text-accent ring-1 ring-accent/40">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
            <p className="mt-0.5 truncate text-muted" title={user.email}>
              {user.email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {methods.map((m) => (
                <span key={m} className="rounded-full border border-border bg-surface-2 px-2.5 py-1">
                  Signs in with {m}
                </span>
              ))}
              {memberSince && <span className="text-muted">Member since {memberSince}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Activity */}
      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <SectionTitle title="Your activity" hint="Tap one to open it in your library." />
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile href="/library" label="Watchlist" value={counts?.watchlist} icon={<ListIcon />} />
          <StatTile href="/library?tab=watching" label="Watching" value={counts?.watching} icon={<PlayIcon />} />
          <StatTile href="/library?tab=seen" label="Seen" value={counts?.seen} icon={<EyeCheckIcon />} />
          <StatTile href="/library?tab=history" label="Picks" value={counts?.history} icon={<span aria-hidden>🎲</span>} />
        </div>
      </section>

      {/* Preferences */}
      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <SectionTitle
          title="Where you watch"
          hint="We use your country to show which streaming services have each title."
        />
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="sr-only" htmlFor="profile-region">
            Country
          </label>
          <Select
            id="profile-region"
            value={user.region}
            onChange={changeRegion}
            options={REGION_OPTIONS}
            searchable
            searchPlaceholder="Search countries…"
            disabled={save.kind === "saving"}
            className="w-full sm:max-w-xs"
          />
          <p aria-live="polite" className="min-h-5 text-sm">
            {save.kind === "saving" && (
              <span className="inline-flex items-center gap-2 text-muted">
                <Spinner width={14} height={14} /> Saving…
              </span>
            )}
            {save.kind === "saved" && (
              <span className="inline-flex items-center gap-1.5 text-success">
                <CheckIcon width={16} height={16} /> Saved
              </span>
            )}
            {save.kind === "error" && <span className="text-accent">{save.message}</span>}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <SectionTitle title="Appearance" hint="Light, dark, or match your device. Saved in this browser." />
        <div className="mt-5">
          <label className="sr-only" htmlFor="profile-theme">
            Theme
          </label>
          <ThemePicker id="profile-theme" className="w-full sm:max-w-xs" />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <SectionTitle
          title="Ratings"
          hint="Which score to show on titles. Spins' minimum rating always uses IMDb. Saved in this browser."
        />
        <div className="mt-5">
          <label className="sr-only" htmlFor="profile-rating">
            Ratings from
          </label>
          <RatingSourcePicker id="profile-rating" />
        </div>
      </section>

      {/* Session */}
      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionTitle title="Log out" hint="Sign out of Cynatra on this browser." />
        <button onClick={logout} className={`${secondaryBtn} sm:w-auto sm:px-6`}>
          Log out
        </button>
      </section>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{hint}</p>
    </div>
  );
}

function StatTile({ href, label, value, icon }: { href: string; label: string; value?: number; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-surface-2/60 p-4 transition-colors hover:border-muted"
    >
      <span className="text-accent">{icon}</span>
      <span className="mt-3 block text-2xl font-semibold tabular-nums">
        {value ?? <span className="inline-block h-7 w-8 rounded bg-surface-2 animate-pulse align-middle" />}
      </span>
      <span className="text-sm text-muted group-hover:text-foreground">{label}</span>
    </Link>
  );
}

const primaryBtn =
  "flex w-full items-center justify-center rounded-xl bg-accent py-3 font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110";
const secondaryBtn =
  "flex w-full items-center justify-center rounded-xl border border-border py-3 text-sm text-muted transition-colors hover:border-muted hover:text-foreground";
