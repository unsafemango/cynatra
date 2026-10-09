"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const REGIONS = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["IE", "Ireland"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["IN", "India"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
  ["NG", "Nigeria"],
  ["ZA", "South Africa"],
] as const;

export default function ProfilePage() {
  const { user, ready, setUser } = useAuth();
  const [picked, setRegion] = useState<string | null>(null);
  const region = picked ?? user?.region ?? "US";
  const [status, setStatus] = useState<string | null>(null);

  // Don't show an old "Saved." when coming back to this (kept-alive) page.
  useLayoutEffect(() => () => setStatus(null), []);

  if (ready && !user) {
    return (
      <p className="text-center text-muted pt-12">
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>{" "}
        to manage your profile.
      </p>
    );
  }

  const save = async () => {
    setStatus(null);
    try {
      const r = await api<{ user: User }>("/api/auth/me", { method: "PATCH", body: JSON.stringify({ region }) });
      setUser(r.user);
      setStatus("Saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Couldn't save.");
    }
  };

  return (
    <div className="max-w-md mx-auto pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted">{user?.email}</p>

      <label className="block mt-8">
        <span className="block text-sm font-medium">Country</span>
        <span className="block text-xs text-muted mb-2">Used for “where to watch”.</span>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5"
        >
          {REGIONS.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium">
          Save
        </button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </div>
  );
}
