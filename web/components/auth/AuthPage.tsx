"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useState, type ReactNode } from "react";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import {
  AlertIcon,
  CheckIcon,
  EyeCheckIcon,
  EyeIcon,
  EyeOffIcon,
  ListIcon,
  LockIcon,
  MailIcon,
  PlayIcon,
  Spinner,
} from "@/components/icons";
import { LogoMark } from "@/components/Logo";
import { VerifyEmailStep } from "@/components/VerifyEmailStep";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Mode = "login" | "register";

// Carries a typed email across the Log in ↔ Sign up switch (separate routes).
let carriedEmail = "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Log in (/login) and Sign up (/register): one component, two routes. */
export function AuthPage({ mode }: { mode: Mode }) {
  const { user, ready, login, register, verifyEmail, resendCode, loginWithGoogle, logout } = useAuth();
  const router = useRouter();
  const ids = useId();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "popup-closed": Google's popup just closed; Google is still finishing.
  // "google": waiting for our server to accept Google's sign-in.
  // "redirecting": signed in, waiting for the spin page to appear.
  // All show "Signing you in…" so the form never flashes in between.
  const [signingIn, setSigningIn] = useState<null | "popup-closed" | "google" | "redirecting">(null);
  // Set after "Create account": the address waiting for its emailed code.
  const [pending, setPending] = useState<{ email: string; resendAfterSeconds: number } | null>(null);
  // From the gateway; null hides the Google button.
  // undefined while asking the gateway; null when Google sign-in isn't set up.
  const [googleClientId, setGoogleClientId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    api<{ googleClientId: string | null }>("/api/auth/config")
      .then((c) => setGoogleClientId(c.googleClientId))
      .catch(() => setGoogleClientId(null));
  }, []);

  // Runs on arrival (and when this kept-alive page is shown again).
  useEffect(() => {
    if (carriedEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail((cur) => cur || carriedEmail);
      carriedEmail = "";
    }
  }, []);

  // Next.js keeps this page mounted (hidden) after you leave it, form values
  // included. Never keep a typed password around: clear it whenever hidden.
  useLayoutEffect(
    () => () => {
      setPassword("");
      setShowPassword(false);
      setSigningIn(null);
      setError(null);
    },
    [],
  );

  const emailValid = EMAIL_RE.test(email.trim());
  const emailError = emailTouched && email.length > 0 && !emailValid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!emailValid) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        const { resendAfterSeconds } = await register(email, password);
        setPassword("");
        setPending({ email: email.trim().toLowerCase(), resendAfterSeconds });
        return;
      }
      await login(email, password);
      setSigningIn("redirecting");
      setEmail("");
      setPassword("");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential: string) => {
    setSigningIn("google");
    setError(null);
    try {
      await loginWithGoogle(credential);
      setSigningIn("redirecting");
      setEmail("");
      setPassword("");
      router.push("/");
    } catch (err) {
      setSigningIn(null);
      setError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
    }
  };

  const onGooglePopupClosed = () => {
    setSigningIn((s) => s ?? "popup-closed");
    // Closed without choosing an account: Google never calls back, so bring the form back.
    setTimeout(() => setSigningIn((s) => (s === "popup-closed" ? null : s)), 4000);
  };

  const capsCheck = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  if (signingIn) {
    // A plain loading screen, deliberately unlike the login card.
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-background"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center text-center">
          <LogoMark size={64} className="block animate-pulse" />
          <p className="mt-6 text-lg font-medium">Signing you in…</p>
          <p className="mt-1 text-sm text-muted">Taking you to Cynatra.</p>
        </div>
      </div>
    );
  }

  if (ready && user && !busy) {
    return (
      <AuthShell>
        <div className="text-center py-6">
          <LogoMark size={56} className="block mx-auto mb-5" />
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re logged in</h1>
          <p className="mt-1 text-muted">as {user.email}</p>
          <div className="mt-8 grid gap-3">
            <Link href="/" className={primaryBtn}>
              🎲 Go spin
            </Link>
            <button onClick={logout} className={secondaryBtn}>
              Log out
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (pending) {
    return (
      <AuthShell>
        <LogoMark size={44} className="block mb-5" />
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-1 text-muted">One last step to create your account.</p>
        <VerifyEmailStep
          key={pending.email}
          email={pending.email}
          resendAfterSeconds={pending.resendAfterSeconds}
          onVerify={async (code) => {
            await verifyEmail(pending.email, code);
            setSigningIn("redirecting");
            setPending(null);
            setEmail("");
            router.push("/");
          }}
          onResend={() => resendCode(pending.email)}
          onChangeEmail={() => {
            setPending(null);
            setError(null);
          }}
        />
      </AuthShell>
    );
  }

  const isLogin = mode === "login";
  const checks = {
    length: password.length >= 8,
    mix: /[A-Za-z]/.test(password) && /[^A-Za-z]/.test(password),
    long: password.length >= 12,
  };
  const strength = Number(checks.length) + Number(checks.length && checks.mix) + Number(checks.length && checks.long);

  return (
    <AuthShell>
      <LogoMark size={44} className="block mb-5" />
      <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">
        {isLogin ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-muted">
        {isLogin ? "Log in to your watchlist, history and picks." : "Free, and takes less than a minute."}
      </p>

      <nav aria-label="Log in or sign up" className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/60 p-1">
        {(["login", "register"] as const).map((m) => (
          <Link
            key={m}
            href={m === "login" ? "/login" : "/register"}
            aria-current={mode === m ? "page" : undefined}
            onClick={() => (carriedEmail = email)}
            className={`rounded-lg py-2 text-center text-sm font-medium transition-colors ${
              mode === m ? "bg-surface-2 text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </Link>
        ))}
      </nav>

      {googleClientId === undefined && (
        // Holds the Google button's place while we find out, so the form doesn't drop.
        <div className="mt-6" aria-hidden>
          <div className="h-11 rounded-full bg-surface-2/70 animate-pulse" />
          <div className="mt-6 h-4" />
        </div>
      )}
      {googleClientId && (
        <div className="mt-6">
          <GoogleSignIn
            clientId={googleClientId}
            onCredential={onGoogle}
            onError={setError}
            onPopupClosed={onGooglePopupClosed}
          />
          <div className="mt-6 flex items-center gap-3 text-xs text-muted" role="separator">
            <span className="h-px flex-1 bg-border" />
            or continue with email
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor={`${ids}-email`} className="block text-sm font-medium mb-1.5">
            Email
          </label>
          <div className="relative">
            <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id={`${ids}-email`}
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              aria-invalid={emailError}
              aria-describedby={emailError ? `${ids}-email-err` : undefined}
              className={`${inputCls} ${emailError ? "border-accent focus:border-accent" : ""}`}
            />
          </div>
          {emailError && (
            <p id={`${ids}-email-err`} className="mt-1.5 text-sm text-accent">
              Enter a valid email, like you@example.com
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${ids}-password`} className="block text-sm font-medium mb-1.5">
            Password
          </label>
          <div className="relative">
            <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id={`${ids}-password`}
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={isLogin ? "Your password" : "At least 8 characters"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={capsCheck}
              onKeyUp={capsCheck}
              onBlur={() => setCapsLock(false)}
              aria-describedby={`${ids}-pw-help`}
              className={`${inputCls} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <div id={`${ids}-pw-help`} aria-live="polite">
            {capsLock && <p className="mt-1.5 text-sm text-accent-2">Caps Lock is on</p>}
            {!isLogin && (
              <div className="mt-2.5">
                <div className="flex gap-1.5" aria-hidden>
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        strength >= i ? ["", "bg-accent", "bg-accent-2", "bg-success"][strength] : "bg-border"
                      }`}
                    />
                  ))}
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  <Requirement met={checks.length}>At least 8 characters</Requirement>
                  <Requirement met={checks.mix}>Letters plus a number or symbol (recommended)</Requirement>
                  <Requirement met={checks.long}>12+ characters for a strong password (recommended)</Requirement>
                </ul>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="flex gap-2.5 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-3 text-sm">
            <AlertIcon className="mt-px shrink-0 text-accent" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={busy || (!isLogin && !checks.length)} className={primaryBtn}>
          {busy && <Spinner />}
          {busy ? (isLogin ? "Logging in…" : "Sending code…") : isLogin ? "Log in" : "Create account"}
        </button>
        {!isLogin && (
          <p className="text-center text-xs text-muted">We&apos;ll email you a 6-digit code to confirm it&apos;s you.</p>
        )}
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        {isLogin ? "New to Cynatra?" : "Already have an account?"}{" "}
        <Link
          href={isLogin ? "/register" : "/login"}
          onClick={() => (carriedEmail = email)}
          className="font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
        >
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </p>
    </AuthShell>
  );
}

function Requirement({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? "text-success" : "text-muted"}`}>
      {met ? <CheckIcon width={14} height={14} strokeWidth={2.4} /> : <span className="grid size-3.5 place-items-center">•</span>}
      <span>
        {children}
        <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
      </span>
    </li>
  );
}

/** Two-column card: the form, and (on wider screens) why an account is worth it. */
function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl sm:pt-4">
      <div className="grid overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl shadow-black/30 md:grid-cols-[1.1fr_1fr]">
        <section className="p-6 sm:p-10">{children}</section>
        <aside className="relative hidden flex-col justify-between overflow-hidden border-l border-border bg-surface-2 p-10 md:flex">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <LogoMark size={52} />
            <p className="mt-6 text-3xl font-semibold leading-tight tracking-tight">
              Stop scrolling.
              <br />
              <span className="text-accent">Start watching.</span>
            </p>
            <ul className="mt-10 space-y-6">
              <Benefit icon={<PlayIcon />} title="One great pick, not a hundred tabs">
                Set a few filters, hit Spin, done.
              </Benefit>
              <Benefit icon={<ListIcon />} title="A watchlist that follows you">
                Save picks, then let Cynatra choose from them.
              </Benefit>
              <Benefit icon={<EyeCheckIcon />} title="Never get something you’ve seen">
                Mark titles seen and they stay out of your spins.
              </Benefit>
            </ul>
          </div>
          <p className="relative mt-10 text-xs text-muted">Free to use. Movie and series data from TMDB.</p>
        </aside>
      </div>
    </div>
  );
}

function Benefit({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-accent">
        {icon}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{children}</span>
      </span>
    </li>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background/60 py-3 pl-11 pr-3.5 placeholder:text-muted/60 transition-colors hover:border-muted/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";
const primaryBtn =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:shadow-none";
const secondaryBtn =
  "flex w-full items-center justify-center rounded-xl border border-border py-3 text-sm text-muted transition-colors hover:border-muted hover:text-foreground";
