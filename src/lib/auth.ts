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
// - VERCEL_ENV / VERCEL_URL / VERCEL_BRANCH_URL → Vercel System
//   Environment Variables, read from process.env with strict validation.
//   They are platform runtime values (hostnames of the current deployment,
//   not owner-managed secrets) and src/config is out of scope for this
//   card; they are only ever used as the base URL and trusted origins.
//   On preview deployments the BASE URL follows the deployment itself so
//   email links land on the preview the user signed up on (A-10). Google
//   OAuth (A-11) stays DISABLED on previews for the same reason: its
//   callback URI cannot be registered for dynamic preview URLs (H-06).
import { z } from "zod";

import {
  createAuthInstance,
  type AuthInstance,
} from "../modules/auth/better-auth";
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
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "must be a bare hostname");

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

/**
 * Preview deployments send email links (and set auth cookies) for THEIR OWN
 * URL, not the production domain (A-10): a tester registering on a preview
 * must receive a link that opens on that same preview. Returns undefined
 * outside Vercel previews, or when the platform host is missing/invalid —
 * callers then fall back to the canonical URL.
 */
export function vercelPreviewBaseURL(): string | undefined {
  if (process.env.VERCEL_ENV !== "preview") return undefined;
  for (const host of [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]) {
    const parsed = vercelHostSchema.safeParse(host);
    if (parsed.success) return `https://${parsed.data}`;
  }
  return undefined;
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

  // Preview deployments outrank the canonical URL (see vercelPreviewBaseURL)
  // so email links point at the deployment the user is actually using.
  const baseURL =
    vercelPreviewBaseURL() ??
    serverEnv.BETTER_AUTH_URL ??
    clientEnv.NEXT_PUBLIC_APP_URL;
  if (!baseURL && isProduction) throw missingConfig("BETTER_AUTH_URL");

  let captcha: TurnstileConfig | null = null;
  if (serverEnv.TURNSTILE_SECRET_KEY) {
    captcha = { secretKey: serverEnv.TURNSTILE_SECRET_KEY };
  } else if (isProduction) {
    throw missingConfig("TURNSTILE_SECRET_KEY");
  } else if (nodeEnv === "development") {
    captcha = { secretKey: TURNSTILE_ALWAYS_PASS_TEST_SECRET };
  }

  // Google OAuth (A-11, AUTH-02, H-06). Google needs one registered redirect
  // URI per host, which dynamic Vercel preview URLs cannot provide (H-06
  // note) — so the provider is disabled on previews regardless of config.
  // Production fails fast on missing values (the A-09 pattern); development
  // and test run without the provider until H-06 fills real keys.
  const isVercelPreview = process.env.VERCEL_ENV === "preview";
  let socialProviders:
    | { google: { clientId: string; clientSecret: string } }
    | undefined;
  if (isVercelPreview) {
    console.warn(
      "[auth] Google OAuth dinonaktifkan di deployment preview — URI redirect dinamis tidak bisa didaftarkan di Google (H-06).",
    );
  } else if (!serverEnv.GOOGLE_CLIENT_ID || !serverEnv.GOOGLE_CLIENT_SECRET) {
    if (isProduction) {
      throw missingConfig(
        serverEnv.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID",
      );
    }
    console.warn(
      "[auth] Google OAuth nonaktif — GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET belum diisi (H-06).",
    );
  } else {
    socialProviders = {
      google: {
        clientId: serverEnv.GOOGLE_CLIENT_ID,
        clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
      },
    };
  }

  const resolvedBaseURL = baseURL ?? DEV_FALLBACK_BASE_URL;
  const trustedOrigins = [
    ...new Set([resolvedBaseURL, ...vercelPreviewOrigins()]),
  ];

  // Email wiring (A-10): templates from src/emails, transport per
  // MAIL_TRANSPORT ("log" | "resend"). The transport never throws, so mail
  // failures degrade to a logged line without touching auth responses.
  const [{ getMailTransport }, { createMailCallbacks }] = await Promise.all([
    import("./mail"),
    import("../modules/auth/email-senders"),
  ]);
  const transport = await getMailTransport();
  const mail = createMailCallbacks((message) => transport.send(message), {
    appUrl: resolvedBaseURL,
  });

  cached = createAuthInstance({
    db,
    secret: serverEnv.BETTER_AUTH_SECRET ?? DEV_FALLBACK_SECRET,
    baseURL: resolvedBaseURL,
    trustedOrigins,
    captcha,
    mail,
    socialProviders,
  });
  return cached;
}
