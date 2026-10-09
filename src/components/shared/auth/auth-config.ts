import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { toSessionUser } from "../../../lib/rbac";

// Server-side UI configuration for the (auth) pages (card A-13).
//
// The pages are server components so the CLIENT forms never read
// process.env themselves: whether Google is offered and which Turnstile
// sitekey to render are decided here and passed down as props.
//
// The env modules are imported LAZILY inside the functions (the
// src/lib/auth.ts pattern): "Collecting page data" imports this module at
// build time, and evaluating env.client there fails the BUILD on any
// deployment without required variables (PR #39's previews failed on
// NEXT_PUBLIC_APP_URL, not on the sitekey). Values are therefore read per
// REQUEST on dynamically rendered pages, never frozen into a build, and a
// misconfigured deployment fails the request — clearly — instead of the
// deploy. Pages that do not render the Turnstile widget must call
// getGoogleEnabled() only and never touch the sitekey path.

// Cloudflare's documented always-pass TEST sitekey — the client-side pair of
// the always-pass test SECRET src/lib/auth.ts falls back to in development.
// Never used outside development (mirrored in getTurnstileSiteKey below).
const TURNSTILE_TEST_SITEKEY = "1x0000000000000000000000000000000AA";

/**
 * Whether the Google button is rendered at all. MIRRORS the provider
 * decision in src/lib/auth.ts (getAuth, Google OAuth block): disabled on
 * Vercel previews (dynamic redirect URIs cannot be registered, H-06) and
 * disabled unless both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 * Keep the two rules in sync — the A-13 PR notes a follow-up chore to
 * export this from src/lib/auth.ts as the single source. Never throws.
 */
export async function getGoogleEnabled(): Promise<boolean> {
  const { serverEnv } = await import("../../../config/env.server");
  const isVercelPreview = process.env.VERCEL_ENV === "preview";
  return (
    !isVercelPreview &&
    Boolean(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET)
  );
}

/**
 * Turnstile sitekey for the widget on /masuk, /daftar, /lupa-password and
 * the /daftar/verifikasi resend form (AUTH-10 — TURNSTILE_PROTECTED_ENDPOINTS
 * covers sign-in, sign-up, request-password-reset and send-verification-
 * email); null disables the widget (test environment — the server also
 * skips verification there). May THROW in production without the key — the
 * request-time twin of src/lib/auth.ts's TURNSTILE_SECRET_KEY check, so a
 * misconfigured deployment fails clearly, never silently.
 */
export async function getTurnstileSiteKey(): Promise<string | null> {
  const [{ clientEnv }, { serverEnv }] = await Promise.all([
    import("../../../config/env.client"),
    import("../../../config/env.server"),
  ]);
  if (clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  }
  if (serverEnv.NODE_ENV === "development") {
    // Pairs with the always-pass test secret in src/lib/auth.ts, so the
    // widget renders (and passes) locally before H-05 fills real keys.
    return TURNSTILE_TEST_SITEKEY;
  }
  if (serverEnv.NODE_ENV === "production") {
    // Never silently fall back to the test key in production (product-owner
    // decision): fail fast and name the variable.
    throw missingConfig("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  }
  return null;
}

function missingConfig(variable: string): Error {
  // Names the variable, never its value (the src/lib/auth.ts pattern).
  return new Error(
    `Konfigurasi autentikasi tidak lengkap: ${variable} belum diisi. Lihat docs/tasks/README.md (Environment variables).`,
  );
}

/**
 * Card A-13, product-owner decision: a user who is ALREADY signed in and
 * opens /masuk or /daftar is redirected straight away — to the validated
 * `next` target when present, else the default destination. Verification
 * and reset pages do NOT call this: verification signs the user in as its
 * success path, and resetting while signed in on another device is legal
 * (AUTH-06 then revokes every session).
 */
export async function redirectIfSignedIn(target: string): Promise<void> {
  // Lazy import — getAuth pulls the DB client, which must never load at
  // build time (see src/lib/auth.ts).
  const { getAuth } = await import("../../../lib/auth");
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (toSessionUser(session)) redirect(target);
}
