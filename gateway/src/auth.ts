import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { pool } from "./db/index.js";

export type AuthUser = { id: string; email: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: "30d" });
}

/** Attaches req.user when a valid bearer token is present; never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
      if (payload.sub) req.user = { id: payload.sub, email: String(payload.email) };
    } catch {
      // Invalid or expired token: treat as anonymous.
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  next();
}

export function requireDb(_req: Request, res: Response, next: NextFunction) {
  if (!pool) {
    res.status(503).json({ error: "Accounts are disabled (no DATABASE_URL configured)." });
    return;
  }
  next();
}
