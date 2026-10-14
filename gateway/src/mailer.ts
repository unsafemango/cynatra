import nodemailer from "nodemailer";
import { config } from "./config.js";

const transport = config.smtp
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
      requireTLS: config.smtp.port !== 465 && config.smtp.port !== 1025, // never send credentials unencrypted
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : config.smtpUrl
    ? nodemailer.createTransport(config.smtpUrl)
    : null;

/** Logs on startup whether email can be sent, so bad credentials show up right away. */
export async function checkMailer() {
  if (!transport) {
    console.log("email: not configured; sign-up codes will be printed here (dev only)");
    return;
  }
  const target = config.smtp ? `${config.smtp.host}:${config.smtp.port}` : "SMTP_URL";
  try {
    await transport.verify();
    console.log(`email: ready via ${target}, sending as ${config.emailFrom}`);
  } catch (err) {
    console.error(`email: can't connect to ${target}: ${(err as Error).message}`);
  }
}

/** Emails a sign-up code. Without SMTP configured, logs it instead (development only). */
export async function sendSignupCode(email: string, code: string, minutes: number) {
  if (!transport) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_URL is not configured");
    console.log(`[dev] sign-up code for ${email}: ${code} (set SMTP_URL to send real emails)`);
    return;
  }
  await transport.sendMail({
    from: config.emailFrom,
    to: email,
    subject: `${code} is your Cynatra code`,
    text: `Your Cynatra verification code is ${code}.\n\nIt expires in ${minutes} minutes. If you didn't try to sign up, you can ignore this email.`,
    html: `<!doctype html>
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#16141E">
  <p style="margin:0 0 8px;font-size:18px;font-weight:600">Confirm your email</p>
  <p style="margin:0 0 24px;color:#55506A">Enter this code in Cynatra to finish signing up:</p>
  <p style="margin:0 0 24px;font-size:36px;font-weight:700;letter-spacing:8px;color:#E8474D">${code}</p>
  <p style="margin:0;font-size:13px;color:#77728A">It expires in ${minutes} minutes. If you didn't try to sign up, you can ignore this email.</p>
</div>`,
  });
}

export type SupportMessage = {
  name?: string;
  email: string;
  topic: string;
  message: string;
  /** The Cynatra account it came from, when the sender was logged in. */
  account?: string;
};

/**
 * Delivers a contact-form message to the support inbox. Reply-To is the
 * sender, so replying in the inbox answers them directly. Nothing is sent to
 * the address they typed, so the form can't be used to email strangers.
 */
export async function sendSupportMessage(m: SupportMessage) {
  const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  const preview = oneLine(m.message).slice(0, 60);
  const text = [
    `From: ${m.name ? `${oneLine(m.name)} <${m.email}>` : m.email}`,
    `Account: ${m.account ?? "not logged in"}`,
    `Topic: ${m.topic}`,
    "",
    m.message,
    "",
    "— Sent from the Cynatra Help page. Reply to answer them directly.",
  ].join("\n");

  if (!transport || !config.supportEmail) {
    if (process.env.NODE_ENV === "production") throw new Error("Support email is not configured");
    console.log(`[dev] support message (set SUPPORT_EMAIL and SMTP to deliver it):\n${text}`);
    return;
  }
  await transport.sendMail({
    from: config.emailFrom,
    to: config.supportEmail,
    replyTo: { name: m.name ? oneLine(m.name) : "", address: m.email },
    subject: `[Cynatra support] ${m.topic}: ${preview}`,
    text,
  });
}
