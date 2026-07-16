import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error("DATABASE_URL_TEST is not set (expected in .env.local)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_TEST,
  },
});
