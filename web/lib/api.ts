export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export type Kind = "movie" | "series" | "animation";
export type PickType = Kind | "any";

export type Provider = { name: string; logo: string };

export type Title = {
  id: string; // "movie:123" | "tv:456"
  tmdbId: number;
  mediaType: "movie" | "tv";
  kind: Kind;
  title: string;
  overview: string;
  posterUrl?: string;
  backdropUrl?: string;
  rating: number;
  voteCount: number;
  year?: number;
  runtime?: number;
  seasons?: number;
  genres: string[];
  trailerKey?: string;
  tmdbUrl: string;
  whereToWatch?: { link: string; stream: Provider[]; rent: Provider[]; buy: Provider[] };
  /** Picked by the bright & colourful look filter. */
  colorful?: boolean;
};

export type Genre = { slug: string; label: string };

export type Filters = {
  type: PickType;
  genres: string[];
  minRating: number;
  yearFrom?: number;
  yearTo?: number;
  maxRuntime?: number;
  language?: string;
  /** "colorful": only titles whose images look bright and colourful. */
  look?: "any" | "colorful";
};

export type User = {
  id: string;
  email: string;
  region: string;
  // From /api/auth/me (absent right after logging in until the next refresh).
  createdAt?: string;
  hasPassword?: boolean;
  hasGoogle?: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "cynatra:token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode): stay logged out.
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Can't reach Cynatra's server. Is the gateway running?", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

/** "movie:123" <-> "movie-123" for URLs. */
export const toSlug = (id: string) => id.replace(":", "-");
export const fromSlug = (slug: string) => slug.replace("-", ":");

export function formatRuntime(t: Title) {
  if (!t.runtime) return null;
  const h = Math.floor(t.runtime / 60);
  const m = t.runtime % 60;
  const base = h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m}m`;
  return t.mediaType === "tv" ? `${base} / ep` : base;
}
