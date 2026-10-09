export const config = {
  port: Number(process.env.PORT ?? 4000),
  pickerUrl: (process.env.PICKER_URL ?? "http://localhost:8081").replace(/\/$/, ""),
  databaseUrl: process.env.DATABASE_URL || undefined,
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
};

if (process.env.NODE_ENV === "production" && config.jwtSecret === "dev-only-secret") {
  throw new Error("JWT_SECRET must be set in production");
}
