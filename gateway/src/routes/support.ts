import { Router } from "express";
import { z } from "zod";
import { sendSupportMessage } from "../mailer.js";

// The Help page's contact form.
export const supportRouter = Router();

export const SUPPORT_TOPICS = [
  "Account & sign-in",
  "Spins & recommendations",
  "Something isn't working",
  "Feature idea",
  "Other",
] as const;

const supportRequest = z.object({
  name: z.string().trim().max(80).optional(),
  // Logged-out visitors only; logged in, replies go to the account's email.
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254).optional(),
  topic: z.enum(SUPPORT_TOPICS, { error: "Choose a topic." }),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(5000),
  // Honeypot: hidden from people, filled in by bots.
  website: z.string().optional(),
});

/** Counts events per key over a sliding window, in memory (fine for one gateway). */
function limiter(max: number, windowMs: number) {
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

const HOUR = 60 * 60 * 1000;
const perIp = limiter(5, HOUR);
const perEmail = limiter(3, HOUR);
// Brevo's free plan is 300 emails a day, shared with sign-up codes.
const overall = limiter(100, 24 * HOUR);

supportRouter.post("/", async (req, res) => {
  const parsed = supportRequest.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Please check the form." });
    return;
  }
  const { website, email: typedEmail, ...rest } = parsed.data;
  const email = req.user?.email ?? typedEmail;
  if (!email) {
    res.status(400).json({ error: "Enter your email so we can reply." });
    return;
  }
  const message = { ...rest, email };
  // Bots get the same answer as people, so they don't learn to skip the field.
  if (website) {
    res.status(202).json({ ok: true });
    return;
  }
  if (!perIp(req.ip ?? "unknown") || !perEmail(message.email) || !overall("all")) {
    res.status(429).json({ error: "Too many messages for now. Please try again later." });
    return;
  }
  try {
    await sendSupportMessage({ ...message, account: req.user?.email });
  } catch (err) {
    console.error("support message:", err);
    res.status(502).json({ error: "We couldn't send your message. Please email support@cynatra.app instead." });
    return;
  }
  res.status(202).json({ ok: true });
});
