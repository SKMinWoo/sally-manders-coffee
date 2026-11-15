import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no local env file: CI and Vercel set DATABASE_URL themselves
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/platform/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
