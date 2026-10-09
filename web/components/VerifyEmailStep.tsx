"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Second step of email sign-up: enter the 6-digit code we emailed.
 * Submits by itself once six digits are in (typed, pasted or autofilled).
 */
export function VerifyEmailStep({
  email,
  resendAfterSeconds,
  onVerify,
  onResend,
  onChangeEmail,
}: {
  email: string;
  resendAfterSeconds: number;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<number>;
  onChangeEmail: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(() => Date.now() + resendAfterSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Don't keep a half-typed code around while the (kept-alive) page is hidden.
  useLayoutEffect(() => () => setCode(""), []);

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const submit = async (value: string) => {
    if (busy || value.length !== 6) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await onVerify(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the code.");
      setCode("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      const wait = await onResend();
      setResendAt(Date.now() + wait * 1000);
      setNow(Date.now());
      setCode("");
      setNotice("New code sent. Older codes no longer work.");
      input.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send a new code.");
    }
  };

  return (
    <div className="mt-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(code);
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="block text-sm mb-2">
            Enter the 6-digit code we sent to <span className="font-medium text-foreground">{email}</span>
          </span>
          <input
            ref={input}
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="••••••"
            value={code}
            disabled={busy}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(digits);
              if (digits.length === 6) submit(digits);
            }}
            aria-describedby="code-help"
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-center text-3xl font-semibold tabular-nums tracking-[0.5em] placeholder:text-muted/40 focus:outline-none focus:border-accent disabled:opacity-60"
          />
        </label>
        <p id="code-help" className="text-xs text-muted">
          It expires in 10 minutes. Can&apos;t find it? Check your spam folder.
        </p>
        {error && (
          <p role="alert" className="text-sm text-accent">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted">
            {notice}
          </p>
        )}
        <button
          disabled={busy || code.length !== 6}
          className="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Checking…" : "Confirm email"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button onClick={onChangeEmail} className="text-muted hover:text-foreground">
          ← Use a different email
        </button>
        <button
          onClick={resend}
          disabled={secondsLeft > 0}
          className="text-foreground underline underline-offset-4 disabled:no-underline disabled:text-muted tabular-nums"
        >
          {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
