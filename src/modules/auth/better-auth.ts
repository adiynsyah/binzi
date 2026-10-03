// Better Auth instance factory (card A-09).
//
// Pure, dependency-injected construction of the auth instance so integration
// tests can build one over PGlite with a mocked Turnstile verifier and no
// network. This module must NOT import `src/db` (throws without
// DATABASE_URL, breaking CI), `src/config/env.*` (server-only), or anything
// that makes network calls — the production wiring lives in `src/lib/auth.ts`.
//
// Behavior implemented here:
// - drizzleAdapter over the plural identity tables (A-07 schema).
// - Email/password with Better Auth's default hashing (AUTH-01, §12.1).
// - Session: 30 days member / 8 hours staff, FIXED windows (AUTH-07) —
//   `disableSessionRefresh` stops Better Auth from re-extending `expiresAt`
//   to the global 30-day window, which would silently break the staff cap.
//   The staff override happens in `databaseHooks.session.create.before`,
//   exactly where the session (and its expiry) is born; every sign-in
//   creates a fresh session row = token rotation after login (§12.1).
// - `role`/`status` are read-only Better Auth fields (`input: false`):
//   a client cannot set them at registration. With no `defaultValue`, a
//   smuggled value is rejected with 400; an absent one is omitted from the
//   INSERT so the DB default (`MEMBER`/`ACTIVE`) applies.
// - Turnstile (AUTH-10) comes from the official captcha plugin (see
//   `src/lib/turnstile.ts`); it runs on `onRequest`, so requests with an
//   invalid token are rejected before the rate-limit bucket is touched.
// - `binzi-guard` implements AUTH-08 (§12.4): 5 failed attempts per 15
//   minutes per IP+email, counted in the `rate_limits` table. Better
//   Auth's built-in limiter is disabled — it keys by a single identifier
//   and counts successful attempts too.
import { APIError, betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import * as schema from "../../db/schema";
import { users } from "../../db/schema";
import type { Db } from "../../db/client";
import {
  LOGIN_RATE_LIMIT,
  checkLoginRateLimit,
  clearRateLimit,
  extractClientIp,
  loginRateLimitKey,
  registerFailedAttempt,
  signUpRateLimitKey,
} from "../../lib/ratelimit";
import { type TurnstileConfig, turnstilePlugin } from "../../lib/turnstile";
import {
  MEMBER_SESSION_SECONDS,
  STAFF_SESSION_SECONDS,
  isStaffRole,
} from "./policy";
import { PASSWORD_MIN_LENGTH, normalizeEmail, passwordSchema } from "./schema";

/**
 * Identical for unknown email, wrong password, AND a blocked bucket —
 * never reveals whether the account exists (§14.2). The blocked response
 * differs only in status (429 vs 401) so the limit stays observable (V-10).
 */
export const LOGIN_FAILED_MESSAGE = "Email atau kata sandi salah";

const SIGNUP_BLOCKED_MESSAGE =
  "Terlalu banyak percobaan pendaftaran. Coba lagi dalam 15 menit.";

const SIGN_IN_EMAIL_PATH = "/sign-in/email";
const SIGN_UP_EMAIL_PATH = "/sign-up/email";

export type AuthDeps = {
  db: Db;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  /** Null disables Turnstile (local development without keys). */
  captcha: TurnstileConfig | null;
};

// Better Auth hook contexts are loosely typed at the edge (better-call
// middleware inputs); narrow them once, here.
type HookContext = {
  path?: string;
  headers?: Headers;
  request?: Request;
  body?: unknown;
  context?: { returned?: unknown } & Record<string, unknown>;
};

function asHookContext(ctx: unknown): HookContext {
  return ctx as HookContext;
}

/** Reads a top-level field from the (raw, pre-validation) request body. */
async function readBodyField(ctx: HookContext, field: string): Promise<unknown> {
  const fromBody =
    ctx.body && typeof ctx.body === "object" && field in ctx.body
      ? (ctx.body as Record<string, unknown>)[field]
      : undefined;
  if (fromBody !== undefined) return fromBody;

  // HTTP-path fallback: both endpoints set `cloneRequest: true`, so the
  // body can be re-read. Only JSON bodies are handled — the auth client
  // sends JSON; form posts fall back to an empty bucket email.
  if (ctx.request && typeof ctx.request.clone === "function") {
    try {
      const parsed = (await ctx.request.clone().json()) as Record<string, unknown>;
      return parsed[field];
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isApiErrorLike(
  value: unknown,
): value is Error & { statusCode: number; body?: { code?: string } } {
  return (
    value instanceof Error &&
    typeof (value as { statusCode?: unknown }).statusCode === "number" &&
    "body" in value
  );
}

// NOTE on the `after` handlers returning `{}`: better-auth 1.7.7's hook
// dispatcher reads `result.headers` without a null check, so an after-hook
// MUST return an object (empty is fine); `undefined` crashes the request.
function binziGuardPlugin(deps: { db: Db }): BetterAuthPlugin {
  const beforeHandler = async (ctx: unknown, kind: "sign-in" | "sign-up") => {
    const hook = asHookContext(ctx);
    const ip = extractClientIp(hook.headers ?? hook.request?.headers);
    const rawEmail = await readBodyField(hook, "email");
    const email = typeof rawEmail === "string" ? rawEmail : "";
    const key =
      kind === "sign-in"
        ? loginRateLimitKey(ip, email)
        : signUpRateLimitKey(ip, email);

    const decision = await checkLoginRateLimit(deps.db, key, LOGIN_RATE_LIMIT.max);
    if (decision.blocked) {
      throw new APIError("TOO_MANY_REQUESTS", {
        code: kind === "sign-in" ? "RATE_LIMITED" : "SIGNUP_RATE_LIMITED",
        message: kind === "sign-in" ? LOGIN_FAILED_MESSAGE : SIGNUP_BLOCKED_MESSAGE,
      });
    }

    if (kind === "sign-up") {
      // AUTH-01 letter+digit policy on top of Better Auth's length check.
      const rawPassword = await readBodyField(hook, "password");
      const parsed = passwordSchema.safeParse(rawPassword);
      if (!parsed.success) {
        throw new APIError("BAD_REQUEST", {
          code: "PASSWORD_POLICY",
          message:
            parsed.error.issues[0]?.message ??
            "Kata sandi tidak memenuhi kebijakan",
        });
      }
    }

    return undefined; // proceed to the endpoint
  };

  return {
    id: "binzi-guard",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN_EMAIL_PATH,
          handler: (ctx) => beforeHandler(ctx, "sign-in"),
        },
        {
          matcher: (ctx) => ctx.path === SIGN_UP_EMAIL_PATH,
          handler: (ctx) => beforeHandler(ctx, "sign-up"),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN_EMAIL_PATH,
          handler: async (ctx) => {
            const hook = asHookContext(ctx);
            const ip = extractClientIp(hook.headers ?? hook.request?.headers);
            const rawEmail = await readBodyField(hook, "email");
            const email = typeof rawEmail === "string" ? rawEmail : "";
            const key = loginRateLimitKey(ip, email);
            const returned = hook.context?.returned;

            if (isApiErrorLike(returned)) {
              await registerFailedAttempt(
                deps.db,
                key,
                LOGIN_RATE_LIMIT.windowSeconds,
              );
              // Rewrite the built-in English message so every credential
              // failure — and the blocked response — carries the exact
              // same Indonesian copy (§14.2).
              if (returned.body?.code === "INVALID_EMAIL_OR_PASSWORD") {
                return {
                  response: new APIError("UNAUTHORIZED", {
                    code: "INVALID_EMAIL_OR_PASSWORD",
                    message: LOGIN_FAILED_MESSAGE,
                  }),
                };
              }
              return {};
            }

            // Successful sign-in clears its own bucket: a legit user who
            // typoed their password 4 times must not stay near the limit.
            await clearRateLimit(deps.db, key);
            return {};
          },
        },
        {
          matcher: (ctx) => ctx.path === SIGN_UP_EMAIL_PATH,
          handler: async (ctx) => {
            const hook = asHookContext(ctx);
            const returned = hook.context?.returned;
            if (!isApiErrorLike(returned)) return {};

            const ip = extractClientIp(hook.headers ?? hook.request?.headers);
            const rawEmail = await readBodyField(hook, "email");
            const email = typeof rawEmail === "string" ? rawEmail : "";
            await registerFailedAttempt(
              deps.db,
              signUpRateLimitKey(ip, email),
              LOGIN_RATE_LIMIT.windowSeconds,
            );
            return {};
          },
        },
      ],
    },
  };
}

export function createAuthInstance(deps: AuthDeps) {
  return betterAuth({
    secret: deps.secret,
    baseURL: deps.baseURL,
    trustedOrigins: deps.trustedOrigins,
    database: drizzleAdapter(deps.db, {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      // A-10 flips this once email delivery (magic-link verification) lands.
      requireEmailVerification: false,
      autoSignIn: true,
    },
    session: {
      expiresIn: MEMBER_SESSION_SECONDS,
      // Fixed windows from login (AUTH-07): refreshing would reset staff
      // sessions to the global 30-day window.
      disableSessionRefresh: true,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, input: false, returned: true },
        status: { type: "string", required: false, input: false, returned: true },
      },
    },
    // AUTH-08 is enforced by binzi-guard against the `rate_limits` table.
    rateLimit: { enabled: false },
    advanced: {
      // Deterministic on baseURL (Vercel is always https): `Secure` outside
      // development, plain cookie on http://localhost.
      useSecureCookies: deps.baseURL.startsWith("https://"),
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const rows = await deps.db
              .select({ role: users.role })
              .from(users)
              .where(eq(users.id, session.userId))
              .limit(1);
            const role = rows[0]?.role;
            if (role && isStaffRole(role)) {
              return {
                data: {
                  expiresAt: new Date(Date.now() + STAFF_SESSION_SECONDS * 1000),
                },
              };
            }
            return undefined;
          },
        },
      },
    },
    plugins: [
      ...(deps.captcha ? [turnstilePlugin(deps.captcha)] : []),
      binziGuardPlugin({ db: deps.db }),
    ],
  });
}

export type AuthInstance = ReturnType<typeof createAuthInstance>;

/** Exposed for tests asserting bucket-key normalization. */
export { normalizeEmail };
