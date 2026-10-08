import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clientEnv } from "../../../config/env.client";
import { serverEnv } from "../../../config/env.server";
import { toSessionUser } from "../../../lib/rbac";

// Server-side UI configuration for the (auth) pages (card A-13).
//
// The pages are server components so the CLIENT forms never read
// process.env themselves: whether Google is offered and which Turnstile
// sitekey to render are decided here and passed down as props.
//
// Both functions are read PER REQUEST on dynamically rendered pages — never
// at build time. A statically prerendered page would freeze the values into
// HTML built elsewhere (and evaluating the sitekey check during a build
// without the variable fails the deploy, as PR #39's first preview showed).
// Pages that do not render the Turnstile widget must call getGoogleEnabled()
// only and never touch the sitekey path.

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
export function getGoogleEnabled(): boolean {
  const isVercelPreview = process.env.VERCEL_ENV === "preview";
  return (
    !isVercelPreview &&
    Boolean(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET)
  );
}

/**
 * Turnstile sitekey for the widget on /masuk and /daftar (AUTH-10 protects
 * sign-in/sign-up only); null disables the widget (test environment — the
 * server also skips verification there). May THROW in production without
 * the key — the request-time twin of src/lib/auth.ts's TURNSTILE_SECRET_KEY
 * check, so a misconfigured deployment fails clearly, never silently.
 */
export function getTurnstileSiteKey(): string | null {
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
