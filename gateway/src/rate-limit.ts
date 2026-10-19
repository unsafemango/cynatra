import type { NextFunction, Request, Response } from "express";

/**
 * Counts events per key over a sliding window, in memory (fine for one
 * gateway). Returns false once a key has used up its allowance.
 */
export function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.clear(); // don't grow without bound
    return true;
  };
}

// The web server's own requests (server-rendered pages, the sitemap) come from
// inside the cluster or Docker network, never from a visitor: don't count them.
const INTERNAL = /^(::ffff:)?(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)|^::1$/;

/**
 * Express middleware: at most `max` requests per visitor IP per window, then a
 * 429 with Retry-After. Requests from inside the cluster aren't limited.
 */
export function perIp(max: number, windowMs: number, message = "Too many requests. Please wait a moment and try again.") {
  const allow = limiter(max, windowMs);
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? "unknown";
    if (INTERNAL.test(ip) || allow(ip)) return next();
    res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
    res.status(429).json({ error: message });
  };
}
