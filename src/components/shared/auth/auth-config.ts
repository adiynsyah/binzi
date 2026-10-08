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

// Cloudflare's documented always-pass TEST sitekey — the client-side pair of
// the always-pass test SECRET src/lib/auth.ts falls back to in development.
// Never used outside development (mirrored in getAuthUiConfig below).
const TURNSTILE_TEST_SITEKEY = "1x0000000000000000000000000000000AA";

export type AuthUiConfig = {
  /**
   * Whether the Google button is rendered at all. MIRRORS the provider
   * decision in src/lib/auth.ts (getAuth, Google OAuth block): disabled on
   * Vercel previews (dynamic redirect URIs cannot be registered, H-06) and
   * disabled unless both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
   * Keep the two rules in sync — the A-13 PR notes a follow-up chore to
   * export this from src/lib/auth.ts as the single source.
   */
  googleEnabled: boolean;
  /**
   * Turnstile sitekey for the widget; null disables the widget (test
   * environment — the server also skips verification there).
   */
  turnstileSiteKey: string | null;
};

function missingConfig(variable: string): Error {
  // Names the variable, never its value (the src/lib/auth.ts pattern).
  return new Error(
    `Konfigurasi autentikasi tidak lengkap: ${variable} belum diisi. Lihat docs/tasks/README.md (Environment variables).`,
  );
}

export async function getAuthUiConfig(): Promise<AuthUiConfig> {
  // MIRRORS src/lib/auth.ts — see AuthUiConfig.googleEnabled.
  const isVercelPreview = process.env.VERCEL_ENV === "preview";
  const googleEnabled =
    !isVercelPreview &&
    Boolean(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET);

  let turnstileSiteKey: string | null = null;
  if (clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    turnstileSiteKey = clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else if (serverEnv.NODE_ENV === "development") {
    // Pairs with the always-pass test secret in src/lib/auth.ts, so the
    // widget renders (and passes) locally before H-05 fills real keys.
    turnstileSiteKey = TURNSTILE_TEST_SITEKEY;
  } else if (serverEnv.NODE_ENV === "production") {
    // Never silently fall back to the test key in production (product-owner
    // decision): fail fast and name the variable.
    throw missingConfig("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  }

  return { googleEnabled, turnstileSiteKey };
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
