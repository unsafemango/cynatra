"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, type User } from "./api";

type AuthState = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  /** Signs in with the ID token from "Continue with Google". */
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

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
    setUser(r.user);
  }, []);

  const value: AuthState = {
    user,
    ready,
    login: (email, password) => authenticate("/api/auth/login", { email, password }),
    register: (email, password) => authenticate("/api/auth/register", { email, password }),
    loginWithGoogle: (credential) => authenticate("/api/auth/google", { credential }),
    logout: () => {
      setToken(null);
      setUser(null);
    },
    setUser,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
