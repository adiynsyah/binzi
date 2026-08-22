import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration (TASK 004, Drizzle Spec §2 / Blueprint §9).
 *
 * - Schema source of truth: src/db/schema/ (created in TASK 006).
 * - Generated migrations land in src/db/migrations/ (first migration
 *   is generated in TASK 007).
 * - drizzle-kit loads `.env` automatically, providing DATABASE_URL
 *   for `db:generate` and `db:migrate`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
