"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { markSavedAfterLogin, takePending } from "./after-login";
import { api, getToken, setToken, type User } from "./api";
import { addToWatchlist, clearLocalSeen, localSeen } from "./library";

type AuthState = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Starts email sign-up: emails a code. No account until verifyEmail succeeds. */
  register: (email: string, password: string) => Promise<{ resendAfterSeconds: number }>;
  /** Confirms the emailed code: creates the account and signs in. */
  verifyEmail: (email: string, code: string) => Promise<void>;
  /** Sends a new code; resolves with the seconds until another can be sent. */
  resendCode: (email: string) => Promise<number>;
  /** Signs in with the ID token from "Continue with Google". */
  loginWithGoogle: (credential: string) => Promise<void>;
  /** Signs out and shows the "You've logged out" page. */
  logout: () => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const restore = getToken()
      ? api<{ user: User }>("/api/auth/me")
          .then((r) => setUser(r.user))
          .catch(() => setToken(null))
      : Promise.resolve();
    restore.finally(() => setReady(true));
  }, []);

  const authenticate = useCallback(async (path: string, body: object) => {
    const r = await api<{ token: string; user: User }>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(r.token);
    await carryOverGuestActivity();
    setUser(r.user);
  }, []);

  const value: AuthState = {
    user,
    ready,
    login: (email, password) => authenticate("/api/auth/login", { email, password }),
    register: (email, password) =>
      api<{ resendAfterSeconds: number }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    verifyEmail: (email, code) => authenticate("/api/auth/register/verify", { email, code }),
    resendCode: async (email) =>
      (
        await api<{ resendAfterSeconds: number }>("/api/auth/register/resend", {
          method: "POST",
          body: JSON.stringify({ email }),
        })
      ).resendAfterSeconds,
    loginWithGoogle: (credential) => authenticate("/api/auth/google", { credential }),
    logout: () => {
      setToken(null);
      setUser(null);
      router.push("/logged-out");
    },
    setUser,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Just signed in: save what the visitor did while logged out to the account.
 * Runs before the user is set, so pages that then load the library see it.
 * Failures don't block signing in.
 */
async function carryOverGuestActivity() {
  const seen = localSeen();
  const title = takePending();
  await Promise.all([
    seen.length > 0 &&
      api("/api/me/seen/import", { method: "POST", body: JSON.stringify({ ids: seen }) })
        .then(clearLocalSeen)
        .catch((e) => console.warn("[cynatra] couldn't copy seen marks to the account", e)),
    title &&
      addToWatchlist(title)
        .then(() => markSavedAfterLogin(title.id))
        .catch((e) => console.warn("[cynatra] couldn't add the saved title to the watchlist", e)),
  ]);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
