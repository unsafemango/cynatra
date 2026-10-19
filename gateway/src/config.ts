export const config = {
  port: Number(process.env.PORT ?? 4000),
  pickerUrl: (process.env.PICKER_URL ?? "http://localhost:8081").replace(/\/$/, ""),
  databaseUrl: process.env.DATABASE_URL || undefined,
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
  // OAuth client ID for "Sign in with Google". Empty: the Google button is hidden.
  googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
  // Email delivery for sign-up codes. Either separate settings (preferred for
  // providers like Brevo, whose login contains "@")...
  smtp: process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      }
    : undefined,
  // ...or one URL, e.g. smtp://mailpit:1025 locally. Neither: codes are logged (dev only).
  smtpUrl: process.env.SMTP_URL || undefined,
  emailFrom: process.env.EMAIL_FROM || "Cynatra <no-reply@cynatra.local>",
  // Where the Help page's contact form delivers messages. Empty: they're logged (dev only).
  supportEmail: process.env.SUPPORT_EMAIL || undefined,
};

if (process.env.NODE_ENV === "production" && config.jwtSecret === "dev-only-secret") {
  throw new Error("JWT_SECRET must be set in production");
}

/** Country for streaming availability when none is given: Canada, where Cynatra is made. */
export const DEFAULT_REGION = "CA";
