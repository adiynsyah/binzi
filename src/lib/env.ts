import "server-only";
import { z } from "zod";

/**
 * BINZI environment access (TASK 004).
 *
 * Enforces the Architecture Specification §29 separation:
 * - `publicEnv`  → values that may reach the browser. Only NEXT_PUBLIC_*
 *   variables belong here; browser code reads them via
 *   `process.env.NEXT_PUBLIC_*` directly.
 * - `serverEnv`  → secrets that must never be bundled into client code
 *   (SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL).
 *
 * This module is guarded by `import "server-only"`, so any accidental
 * import from a Client Component fails the build instead of leaking
 * secrets.
 *
 * Validation is lazy and memoized: each group is checked on first use,
 * so consuming the database does not require Supabase keys to be set
 * (and vice versa).
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Absolute site origin for SEO URL fields (TASK 063, UI/UX §44
  // "Canonical URL" / Blueprint §44 "canonical URLs, sitemap, robots").
  // Optional so existing environments keep working; consumers use
  // getSiteUrl(), which falls back to the local development origin.
  SITE_URL: z.url().optional(),
});

function parseGroup<S extends z.ZodType>(
  schema: S,
  source: NodeJS.ProcessEnv,
  label: string,
): z.output<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid or missing ${label} environment variables: ${fields}. ` +
        "Copy .env.example to .env and fill in real values.",
    );
  }
  return result.data;
}

function parseServerEnv(): z.output<typeof serverEnvSchema> {
  return parseGroup(serverEnvSchema, process.env, "server");
}

function parsePublicEnv(): z.output<typeof publicEnvSchema> {
  return parseGroup(publicEnvSchema, process.env, "public");
}

let cachedServerEnv: z.output<typeof serverEnvSchema> | undefined;
let cachedPublicEnv: z.output<typeof publicEnvSchema> | undefined;

/** Server-only secrets (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY). */
export function getServerEnv() {
  cachedServerEnv ??= parseServerEnv();
  return cachedServerEnv;
}

/**
 * Absolute site origin (no trailing slash) for canonical URLs, the
 * sitemap, and robots.txt (TASK 063, Blueprint §44). Defaults to the
 * local development origin so dev builds stay valid without config;
 * deployments set SITE_URL to the public origin.
 */
export function getSiteUrl(): string {
  return getServerEnv().SITE_URL ?? "http://localhost:3000";
}

/** Browser-safe values. Readable on the server as well. */
export function getPublicEnv() {
  cachedPublicEnv ??= parsePublicEnv();
  return cachedPublicEnv;
}
