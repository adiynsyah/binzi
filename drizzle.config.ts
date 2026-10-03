// drizzle-kit configuration (generate/migrate/studio).
//
// drizzle-kit runs outside Next.js, so env files are loaded here explicitly
// with the same precedence Next.js uses (.env.local wins over .env). Only the
// migration URL is read: MIGRATION_DATABASE_URL must be the Supabase session
// pooler (port 5432) because drizzle-kit's migration runner needs a session
// connection (PRD §9.6 / A-07).
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  throw new Error(
    "Invalid database configuration: MIGRATION_DATABASE_URL is not set. " +
      "It must point at the Supabase session pooler (port 5432) and is required by drizzle-kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
