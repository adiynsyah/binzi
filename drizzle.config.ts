// drizzle-kit configuration (generate/migrate/studio).
//
// drizzle-kit runs outside Next.js, so env files are loaded here explicitly
// with the same precedence Next.js uses (.env.local wins over .env; a value
// already in the process env always wins over both). Only the migration URL
// is read. Valid targets (card C-05): the LOCAL dev database (npm run
// dev:db, localhost:54330/binzi_local) for local development, or — via the
// wrapper `npm run db:migrate:binzi-dev` — the binzi-dev Supabase session
// pooler (port 5432), which drizzle-kit's migration runner needs as a
// session connection (PRD §9.6 / A-07). The target line printed below is
// the in-process proof of WHICH one is in effect — read it before
// continuing.
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { formatDatabaseTarget } from "./src/db/local-guard";

config({ path: ".env.local" });
config();

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  throw new Error(
    "Invalid database configuration: MIGRATION_DATABASE_URL is not set. " +
      "It must point at the local dev database (npm run dev:db) or the " +
      "binzi-dev Supabase session pooler (port 5432) and is required by drizzle-kit.",
  );
}

// Proof of target, printed on EVERY load so it shows up in drizzle-kit
// output. Never includes the user or password (card C-05 §3).
console.log(`[drizzle] target: ${formatDatabaseTarget(url)}`);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
