import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { optionalAuth } from "./auth.js";
import { config } from "./config.js";
import { perIp } from "./rate-limit.js";
import { migrate, pool } from "./db/index.js";
import { checkMailer } from "./mailer.js";
import { authRouter } from "./routes/auth.js";
import { libraryRouter } from "./routes/library.js";
import { pickRouter } from "./routes/pick.js";
import { supportRouter } from "./routes/support.js";

const app = express();
// Behind the k3s ingress, the visitor's IP is in X-Forwarded-For (for rate limits).
app.set("trust proxy", "loopback, uniquelocal");
// Don't advertise the server software; basic protective headers on every
// response (the API only serves JSON, never pages to frame or run).
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
app.use(cors({ origin: config.corsOrigin }));
// An overall cap per visitor; busier endpoints (login, spins) have their own, lower ones.
app.use("/api", perIp(600, 5 * 60_000));
app.use(express.json({ limit: "100kb" }));
app.use(optionalAuth);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", accounts: Boolean(pool) });
});
app.use("/api", pickRouter);
app.use("/api/auth", authRouter);
app.use("/api/me", libraryRouter);
app.use("/api/support", supportRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const pickerDown = err.name === "TimeoutError" || (err as { cause?: { code?: string } }).cause?.code === "ECONNREFUSED";
  res
    .status(pickerDown ? 502 : 500)
    .json({ error: pickerDown ? "The picker service is unavailable." : "Something went wrong." });
});

await migrate();
void checkMailer();
app.listen(config.port, () => {
  console.log(`gateway listening on :${config.port} (accounts ${pool ? "enabled" : "disabled"})`);
});
