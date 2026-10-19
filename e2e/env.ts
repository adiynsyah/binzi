// Single source of truth for the E2E environment (card A-19 §2).
//
// The guard runs at MODULE LOAD: playwright.config.ts, e2e/db-setup.ts and
// the fixtures all import this module, so an invalid E2E_DATABASE_URL fails
// the run before any DB connection or server process exists.
//
// E2E_DATABASE_URL is the ONLY URL source — the harness never reads
// DATABASE_URL or MIGRATION_DATABASE_URL from the environment. The exported
// E2E_SERVER_ENV object is used BOTH by `next build` and `next start`
// (webServer.command runs them with this env), so the production fail-fast
// paths in src/lib/auth.ts and auth-config.ts run against explicit dummy /
// Cloudflare-test values instead of falling back to `.env.local`.
import { assertE2eDatabaseUrl } from "./db-guard";

/** Local container default; CI overrides via E2E_DATABASE_URL (port 5432). */
const DEFAULT_E2E_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54329/binzi_e2e";

export const E2E_DATABASE_URL = assertE2eDatabaseUrl(
  process.env.E2E_DATABASE_URL ?? DEFAULT_E2E_DATABASE_URL,
);

/**
 * baseURL of the E2E server. Must be EXACTLY the app URL: Better Auth's
 * trustedOrigins compares origins, so `127.0.0.1` would be rejected while
 * the server runs on `localhost`.
 */
export const E2E_BASE_URL = "http://localhost:3100";

/**
 * The ONE env object for build + start (card A-19 §2). Explicit values in
 * the webServer process environment win over `.env.local` (dotenv/Next never
 * overwrite variables that are already set), which is what keeps binzi-dev
 * unreachable even though `next start` loads that file.
 *
 * No real secrets here (§12.6 V-09): the BETTER_AUTH_SECRET is a clearly
 * named E2E-only dummy, the Turnstile pair are Cloudflare's documented
 * always-pass TEST keys, and the Google values are dummies so the button
 * renders like in Production without ever being clicked.
 */
export const E2E_SERVER_ENV: Readonly<Record<string, string>> = {
  // NODE_ENV is set by `next build` / `next start` themselves (production).
  DATABASE_URL: E2E_DATABASE_URL,
  MIGRATION_DATABASE_URL: E2E_DATABASE_URL,
  NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
  BETTER_AUTH_URL: E2E_BASE_URL,
  // Clearly named E2E-only dummy, >= 32 chars (Better Auth requirement).
  BETTER_AUTH_SECRET: "binzi-e2e-only-dummy-better-auth-secret-0123456789",
  MAIL_TRANSPORT: "log",
  // Cloudflare "Testing" keys (checked 19 Okt 2026): this sitekey + secret
  // pair ALWAYS passes verification — the widget, CSP script/frame sources
  // and the server-side siteverify call all run for real.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  // Dummies: the Google button renders (like Production) but is never
  // clicked; the OAuth flow is out of scope for this harness.
  GOOGLE_CLIENT_ID: "binzi-e2e-dummy-google-client-id.invalid",
  GOOGLE_CLIENT_SECRET: "binzi-e2e-dummy-google-client-secret.invalid",
  // VERCEL_ENV is deliberately NOT set: the CSP then matches Production
  // (no vercel.live, no 'unsafe-eval').
};
