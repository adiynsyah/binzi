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
// - Email verification via magic link (AUTH-03, A-10): required before any
//   session exists, the link lives 24 hours, and completing it signs the
//   user in (`autoSignInAfterVerification`). While verification is
//   required, Better Auth also collapses "email already registered" into
//   the same 200 response as a fresh sign-up (timing-equalized) — the
//   `customSyntheticUser` hook mirrors the DB defaults (role/status) so the
//   duplicate response stays shape-identical (enumeration, §14.2).
// - Password reset (AUTH-04, A-10): single-use token valid 1 hour; a
//   successful reset revokes every session of that user.
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
// - `binzi-guard` implements AUTH-08 (§12.4): at most 5 attempts per 15
//   minutes per IP+email ever reach credential verification. Every attempt
//   that passes Turnstile atomically RESERVES a slot in the `rate_limits`
//   table (increment + RETURNING in one upsert), so parallel bursts cannot
//   all slip past a separate check-then-count; a successful sign-in clears
//   its bucket. Better Auth's built-in limiter is disabled — it keys by a
//   single identifier, not IP+email.
import { APIError, betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import * as schema from "../../db/schema";
import { users } from "../../db/schema";
import type { Db } from "../../db/client";
import {
  EMAIL_SEND_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
  clearRateLimit,
  extractClientIp,
  loginRateLimitKey,
  passwordResetRateLimitKey,
  reserveAttempt,
  signUpRateLimitKey,
  verificationEmailRateLimitKey,
} from "../../lib/ratelimit";
import { type TurnstileConfig, turnstilePlugin } from "../../lib/turnstile";
import type { MailCallbacks } from "./email-senders";
import {
  EMAIL_VERIFICATION_SECONDS,
  MEMBER_SESSION_SECONDS,
  PASSWORD_RESET_TOKEN_SECONDS,
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
const REQUEST_PASSWORD_RESET_PATH = "/request-password-reset";
const SEND_VERIFICATION_EMAIL_PATH = "/send-verification-email";

/** §12.4 (A-10): generic copy — never reveals whether the email exists. */
const EMAIL_SEND_BLOCKED_MESSAGE =
  "Terlalu banyak permintaan. Coba lagi dalam satu jam.";

export type AuthDeps = {
  db: Db;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  /** Null disables Turnstile (local development without keys). */
  captcha: TurnstileConfig | null;
  /** Email callbacks (verification / reset / welcome); injected for tests. */
  mail: MailCallbacks;
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
async function readBodyField(
  ctx: HookContext,
  field: string,
): Promise<unknown> {
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
      const parsed = (await ctx.request.clone().json()) as Record<
        string,
        unknown
      >;
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
  // §12.4 (A-10): 3 email-triggering requests per hour per email, reserved
  // BEFORE the endpoint runs so the bucket is identical for registered and
  // unknown addresses (the endpoint's own response already is).
  const emailSendGuard = async (ctx: unknown, kind: "reset" | "resend") => {
    const hook = asHookContext(ctx);
    const rawEmail = await readBodyField(hook, "email");
    const email = typeof rawEmail === "string" ? rawEmail : "";
    const key =
      kind === "reset"
        ? passwordResetRateLimitKey(email)
        : verificationEmailRateLimitKey(email);

    const reservation = await reserveAttempt(
      deps.db,
      key,
      EMAIL_SEND_RATE_LIMIT.max,
      EMAIL_SEND_RATE_LIMIT.windowSeconds,
    );
    if (!reservation.allowed) {
      throw new APIError("TOO_MANY_REQUESTS", {
        code: "RATE_LIMITED",
        message: EMAIL_SEND_BLOCKED_MESSAGE,
      });
    }
    return undefined;
  };

  const beforeHandler = async (ctx: unknown, kind: "sign-in" | "sign-up") => {
    const hook = asHookContext(ctx);
    const ip = extractClientIp(hook.headers ?? hook.request?.headers);
    const rawEmail = await readBodyField(hook, "email");
    const email = typeof rawEmail === "string" ? rawEmail : "";
    const key =
      kind === "sign-in"
        ? loginRateLimitKey(ip, email)
        : signUpRateLimitKey(ip, email);

    // Atomic reservation (AUTH-08): increment-and-read in one upsert, so
    // concurrent requests get distinct counts and at most `max` of them
    // ever reach credential verification — a separate check-then-count
    // would let a parallel burst all pass the check (TOCTOU). Requests
    // rejected here still consumed a slot; they stay counted until the
    // window resets (or a successful sign-in clears the login bucket).
    const reservation = await reserveAttempt(
      deps.db,
      key,
      LOGIN_RATE_LIMIT.max,
    );
    if (!reservation.allowed) {
      throw new APIError("TOO_MANY_REQUESTS", {
        code: kind === "sign-in" ? "RATE_LIMITED" : "SIGNUP_RATE_LIMITED",
        message:
          kind === "sign-in" ? LOGIN_FAILED_MESSAGE : SIGNUP_BLOCKED_MESSAGE,
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
        {
          matcher: (ctx) => ctx.path === REQUEST_PASSWORD_RESET_PATH,
          handler: (ctx) => emailSendGuard(ctx, "reset"),
        },
        {
          matcher: (ctx) => ctx.path === SEND_VERIFICATION_EMAIL_PATH,
          handler: (ctx) => emailSendGuard(ctx, "resend"),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN_EMAIL_PATH,
          handler: async (ctx) => {
            const hook = asHookContext(ctx);
            const returned = hook.context?.returned;

            if (isApiErrorLike(returned)) {
              // The attempt was already counted by the before-hook
              // reservation — nothing to increment here.
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

            const ip = extractClientIp(hook.headers ?? hook.request?.headers);
            const rawEmail = await readBodyField(hook, "email");
            const email = typeof rawEmail === "string" ? rawEmail : "";
            // Successful sign-in clears its own bucket: a legit user who
            // typoed their password 4 times must not stay near the limit.
            await clearRateLimit(deps.db, loginRateLimitKey(ip, email));
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
      // AUTH-03 (A-10): no session until the email is verified. While this
      // is on, Better Auth force-skips the sign-up auto-session and answers
      // a duplicate-email sign-up with the same 200 shape as a fresh one.
      requireEmailVerification: true,
      autoSignIn: true,
      // AUTH-04: single-use reset token, 1 hour.
      resetPasswordTokenExpiresIn: PASSWORD_RESET_TOKEN_SECONDS,
      // A reset that succeeded must close every other device's session.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: deps.mail.sendResetPassword,
      // Mirror the DB defaults so the duplicate sign-up response carries
      // the same role/status as a real insert (enumeration, §14.2).
      customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
        ...coreFields,
        ...additionalFields,
        role: "MEMBER",
        status: "ACTIVE",
        id,
      }),
    },
    emailVerification: {
      // AUTH-03: magic link valid 24 hours; completing it signs the user in.
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: EMAIL_VERIFICATION_SECONDS,
      sendVerificationEmail: deps.mail.sendVerificationEmail,
      // Welcome email (NTF-01) fires once, right after verification.
      afterEmailVerification: deps.mail.afterEmailVerification,
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
        status: {
          type: "string",
          required: false,
          input: false,
          returned: true,
        },
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
                  expiresAt: new Date(
                    Date.now() + STAFF_SESSION_SECONDS * 1000,
                  ),
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
