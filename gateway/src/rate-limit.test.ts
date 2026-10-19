import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { limiter, perIp } from "./rate-limit.js";

test("limiter allows up to max per key, separately for each key", () => {
  const allow = limiter(2, 60_000);
  assert.equal(allow("a"), true);
  assert.equal(allow("a"), true);
  assert.equal(allow("a"), false);
  assert.equal(allow("b"), true);
});

/** Runs the middleware for one request from `ip`; returns the status (200 if it passed). */
function hit(mw: ReturnType<typeof perIp>, ip: string) {
  let status = 200;
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => (headers[k] = v),
    status: (s: number) => ((status = s), res),
    json: () => res,
  } as unknown as Response;
  let passed = false;
  mw({ ip } as Request, res, (() => (passed = true)) as NextFunction);
  return { status: passed ? 200 : status, headers };
}

test("perIp answers 429 with Retry-After once a visitor's allowance is used", () => {
  const mw = perIp(2, 15 * 60_000);
  assert.equal(hit(mw, "203.0.113.7").status, 200);
  assert.equal(hit(mw, "203.0.113.7").status, 200);
  const blocked = hit(mw, "203.0.113.7");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers["Retry-After"], "900");
  // Someone else isn't affected.
  assert.equal(hit(mw, "198.51.100.4").status, 200);
});

test("perIp never limits requests from inside the cluster (server-rendered pages)", () => {
  const mw = perIp(1, 60_000);
  for (const ip of ["10.42.0.17", "::ffff:10.42.0.17", "172.18.0.5", "192.168.1.2", "127.0.0.1", "::1"]) {
    assert.equal(hit(mw, ip).status, 200, ip);
    assert.equal(hit(mw, ip).status, 200, ip);
  }
});
