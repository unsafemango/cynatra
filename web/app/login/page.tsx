"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { LogoMark } from "@/components/Logo";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user, ready, login, register, loginWithGoogle, logout } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set by the gateway; null hides the Google button.
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    api<{ googleClientId: string | null }>("/api/auth/config")
      .then((c) => setGoogleClientId(c.googleClientId))
      .catch(() => setGoogleClientId(null));
  }, []);

  // Next.js keeps this page mounted (hidden) after you leave it, form values
  // included. Never keep a typed password around: clear it, and any error,
  // whenever the page is hidden.
  useLayoutEffect(
    () => () => {
      setPassword("");
      setError(null);
    },
    [],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (mode === "login" ? login : register)(email, password);
      setEmail("");
      setPassword("");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential: string) => {
    setBusy(true);
    setError(null);
    try {
      await loginWithGoogle(credential);
      setEmail("");
      setPassword("");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  if (ready && user && !busy) {
    return (
      <div className="max-w-sm mx-auto pt-8 text-center">
        <LogoMark size={56} className="block mx-auto mb-5" />
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re logged in</h1>
        <p className="mt-1 text-sm text-muted">as {user.email}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:brightness-110">
            🎲 Go spin
          </Link>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:border-muted"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto pt-8">
      <LogoMark size={48} className="block mb-5" />
      <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create an account"}</h1>
      <p className="mt-1 text-sm text-muted">Save a watchlist, keep your pick history, and skip what you&apos;ve seen.</p>

      {googleClientId && (
        <div className="mt-6">
          <GoogleSignIn clientId={googleClientId} onCredential={onGoogle} onError={setError} />
          <div className="mt-5 flex items-center gap-3 text-xs text-muted" role="separator">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form onSubmit={submit} className={googleClientId ? "mt-5 space-y-3" : "mt-6 space-y-3"}>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted text-center">
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <button
          className="text-foreground underline underline-offset-4"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </div>
  );
}

const inputCls =
  "w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-muted";
