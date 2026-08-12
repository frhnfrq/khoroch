import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

import { getDatabaseUrl } from "./src/database-url";

dotenv.config({
  path: "../../apps/web/.env",
});

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ? getDatabaseUrl(process.env.DATABASE_URL) : "",
  },
});
