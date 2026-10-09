import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { optionalAuth } from "./auth.js";
import { config } from "./config.js";
import { migrate, pool } from "./db/index.js";
import { checkMailer } from "./mailer.js";
import { authRouter } from "./routes/auth.js";
import { libraryRouter } from "./routes/library.js";
import { pickRouter } from "./routes/pick.js";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "100kb" }));
app.use(optionalAuth);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", accounts: Boolean(pool) });
});
app.use("/api", pickRouter);
app.use("/api/auth", authRouter);
app.use("/api/me", libraryRouter);

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
