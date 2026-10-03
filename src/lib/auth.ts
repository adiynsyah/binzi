// Production Better Auth singleton (card A-09).
//
// LAZY on purpose: `src/db` throws at import time when DATABASE_URL is
// unset, and CI runs `next build` — which imports this module through the
// route handler — with no database configured. Every runtime dependency is
// therefore imported inside getAuth(); the instance is created on first
// request and memoized.
//
// Configuration sources (owner-managed values come from the A-02 env
// modules, never raw process.env; error messages never include values):
// - BETTER_AUTH_SECRET, TURNSTILE_SECRET_KEY, BETTER_AUTH_URL
//   → src/config/env.server.ts
// - NEXT_PUBLIC_APP_URL → src/config/env.client.ts
// - VERCEL_URL / VERCEL_BRANCH_URL → Vercel System Environment Variables,
//   read from process.env with strict validation. They are platform
//   runtime values (hostnames of the current deployment, not owner-managed
//   secrets) and src/config is out of scope for this card; they are only
//   ever used as trusted origins.
import { z } from "zod";

import { createAuthInstance, type AuthInstance } from "../modules/auth/better-auth";
import type { TurnstileConfig } from "./turnstile";

// Cloudflare's documented integration-test secret that always passes
// verification — keeps local development usable before H-10 fills real
// keys. Never used outside development.
const TURNSTILE_ALWAYS_PASS_TEST_SECRET = "1x0000000000000000000000000000000AA";

const DEV_FALLBACK_BASE_URL = "http://localhost:3000";
// Length >= 32 to satisfy Better Auth; development only, never production.
const DEV_FALLBACK_SECRET = "binzi-development-only-secret-0123456789abcdef";

// VERCEL_URL is a bare host (e.g. "binzi-abc123.vercel.app").
const vercelHostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9-]+(\.[a-z0-9-]+)+$/,
    "must be a bare hostname",
  );

/**
 * Origins of the current Vercel deployment (System Environment Variables):
 * `VERCEL_URL` for production deployments of preview branches,
 * `VERCEL_BRANCH_URL` for the branch-specific alias. Needed so Better Auth
 * accepts requests/redirects on preview URLs alongside the canonical
 * NEXT_PUBLIC_APP_URL.
 */
function vercelPreviewOrigins(): string[] {
  const origins: string[] = [];
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    const parsed = vercelHostSchema.safeParse(host);
    if (parsed.success) origins.push(`https://${parsed.data}`);
  }
  return origins;
}

function missingConfig(variable: string): Error {
  // Names the variable, never its value.
  return new Error(
    `Konfigurasi autentikasi tidak lengkap: ${variable} belum diisi. Lihat docs/tasks/README.md (Environment variables).`,
  );
}

let cached: AuthInstance | undefined;

export async function getAuth(): Promise<AuthInstance> {
  if (cached) return cached;

  const [{ serverEnv }, { clientEnv }, { db }] = await Promise.all([
    import("../config/env.server"),
    import("../config/env.client"),
    import("../db"),
  ]);
  const nodeEnv = serverEnv.NODE_ENV;
  const isProduction = nodeEnv === "production";

  if (!serverEnv.BETTER_AUTH_SECRET) {
    if (isProduction) throw missingConfig("BETTER_AUTH_SECRET");
    console.warn(
      "[auth] BETTER_AUTH_SECRET tidak diisi — memakai secret development sementara. Jangan dipakai di luar development.",
    );
  }

  const baseURL =
    serverEnv.BETTER_AUTH_URL ?? clientEnv.NEXT_PUBLIC_APP_URL;
  if (!baseURL && isProduction) throw missingConfig("BETTER_AUTH_URL");

  let captcha: TurnstileConfig | null = null;
  if (serverEnv.TURNSTILE_SECRET_KEY) {
    captcha = { secretKey: serverEnv.TURNSTILE_SECRET_KEY };
  } else if (isProduction) {
    throw missingConfig("TURNSTILE_SECRET_KEY");
  } else if (nodeEnv === "development") {
    captcha = { secretKey: TURNSTILE_ALWAYS_PASS_TEST_SECRET };
  }

  const resolvedBaseURL = baseURL ?? DEV_FALLBACK_BASE_URL;
  const trustedOrigins = [
    ...new Set([resolvedBaseURL, ...vercelPreviewOrigins()]),
  ];

  cached = createAuthInstance({
    db,
    secret: serverEnv.BETTER_AUTH_SECRET ?? DEV_FALLBACK_SECRET,
    baseURL: resolvedBaseURL,
    trustedOrigins,
    captcha,
  });
  return cached;
}
