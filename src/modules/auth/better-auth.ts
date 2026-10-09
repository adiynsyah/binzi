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
// - Google OAuth (AUTH-02, A-11) arrives via `deps.socialProviders` (wired in
//   `src/lib/auth.ts`; previews/unset configs disable it). The factory
//   default scope is exactly `openid email profile`. `user.validateUserInfo`
//   accepts only Google profiles with email_verified=true and neutralizes
//   same-email UNVERIFIED local accounts (pre-hijack): no link, credential
//   deleted, sessions revoked, fresh verification email offered (rate
//   limited) — refusal code `account_not_verified`. Verified same-email
//   accounts link normally (AUTH-05). `trustedProviders` stays empty so the
//   provider-email-verified requirement applies to Google as well;
//   `requireLocalEmailVerified` is turned OFF because Better Auth's own gate
//   would otherwise short-circuit to a generic `account_not_linked` BEFORE
//   `validateUserInfo` runs — the rule itself lives in the hook for EVERY
//   OAuth provider (the option is global) and FAILS CLOSED: a missing local
//   id or unknown user is refused, never linked. OAuth access/refresh tokens
//   are stored encrypted (`account.encryptOAuthTokens`, §12).
// - `binzi-redirect-guard` (A-11): every client-supplied redirect target —
//   Google `callbackURL`s and the A-10 `callbackURL`/`redirectTo` params —
//   must be an internal path (open-redirect, §14.2).
// - `binzi-guard` implements AUTH-08 (§12.4): at most 5 attempts per 15
//   minutes per IP+email ever reach credential verification. Every attempt
//   that passes Turnstile atomically RESERVES a slot in the `rate_limits`
//   table (increment + RETURNING in one upsert), so parallel bursts cannot
//   all slip past a separate check-then-count; a successful sign-in clears
//   its bucket. Better Auth's built-in limiter is disabled — it keys by a
//   single identifier, not IP+email.
import { APIError, betterAuth } from "better-auth";
import { createEmailVerificationToken } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";

import * as schema from "../../db/schema";
import { accounts, sessions, users } from "../../db/schema";
import type { Db } from "../../db/client";
import { maskEmail } from "../../lib/mail";
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
import {
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  passwordSchema,
  safeInternalRedirectPath,
} from "./schema";

/**
 * Identical for unknown email and wrong password — never reveals whether
 * the account exists (§14.2). A blocked bucket does NOT reuse this copy:
 * its 429 carries LOGIN_BLOCKED_MESSAGE so the response message matches
 * the RATE_LIMITED code (A-13 verification finding; it still never
 * depends on whether the account exists).
 */
export const LOGIN_FAILED_MESSAGE = "Email atau kata sandi salah";

/**
 * AUTH-08 429 copy: per-endpoint rate-limit messages match their codes —
 * login this 15-minute window, sign-up SIGNUP_BLOCKED_MESSAGE (same
 * window), the email-send endpoints the one-hour window
 * (EMAIL_SEND_BLOCKED_MESSAGE). The UI maps its own copy per status/code
 * (auth-errors.ts) and never renders these.
 */
export const LOGIN_BLOCKED_MESSAGE =
  "Terlalu banyak percobaan. Coba lagi dalam 15 menit.";

const SIGNUP_BLOCKED_MESSAGE =
  "Terlalu banyak percobaan pendaftaran. Coba lagi dalam 15 menit.";

const SIGN_IN_EMAIL_PATH = "/sign-in/email";
const SIGN_UP_EMAIL_PATH = "/sign-up/email";
const REQUEST_PASSWORD_RESET_PATH = "/request-password-reset";
const SEND_VERIFICATION_EMAIL_PATH = "/send-verification-email";
const SIGN_IN_SOCIAL_PATH = "/sign-in/social";
const VERIFY_EMAIL_PATH = "/verify-email";
// `/reset-password/:token` arrives with the token in the path, so match by
// prefix rather than the route pattern string.
const RESET_PASSWORD_TOKEN_PATH_PREFIX = "/reset-password/";

const GOOGLE_PROVIDER_ID = "google";
const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * A-11 stable OAuth-callback error codes — A-13 keys its copy on the
 * `?error=` parameter these become. `email_not_verified` matches Better
 * Auth's own OAUTH_CALLBACK_ERROR_CODES value for the same situation.
 * `account_not_verified` is BINZI-specific: it is only reachable by a Google
 * identity that just proved control of the matching inbox, so it discloses
 * nothing to anyone else (no enumeration, §14.2).
 */
export const GOOGLE_EMAIL_NOT_VERIFIED_CODE = "email_not_verified";
export const ACCOUNT_NOT_VERIFIED_CODE = "account_not_verified";

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
  /**
   * OAuth provider configs (A-11, AUTH-02). Undefined disables every
   * provider (missing config outside production, Vercel previews — wiring
   * in `src/lib/auth.ts`, which today passes `google` only; its factory's
   * default scopes already are exactly `openid email profile`). The map is
   * open on purpose: the linking rules in `validateUserInfo` are
   * provider-agnostic, and integration tests prove that with a second,
   * mocked provider.
   */
  socialProviders?: Record<string, { clientId: string; clientSecret: string }>;
};

// Better Auth hook contexts are loosely typed at the edge (better-call
// middleware inputs); narrow them once, here.
type HookContext = {
  path?: string;
  headers?: Headers;
  request?: Request;
  body?: unknown;
  query?: Record<string, unknown>;
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

/**
 * Reads a query parameter for GET endpoints (`/verify-email`,
 * `/reset-password/:token`): from the parsed hook context when Better Auth
 * provides it, else straight from the request URL.
 */
function readQueryParam(ctx: HookContext, field: string): unknown {
  const fromContext = ctx.query?.[field];
  if (fromContext !== undefined) return fromContext;
  if (ctx.request) {
    try {
      return new URL(ctx.request.url).searchParams.get(field) ?? undefined;
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
          kind === "sign-in" ? LOGIN_BLOCKED_MESSAGE : SIGNUP_BLOCKED_MESSAGE,
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

// A-11: every redirect target Better Auth accepts from a client — the Google
// login `callbackURL`s AND the A-10 redirect params (verification
// `callbackURL`, reset `redirectTo`) — must be an internal path
// (`safeInternalRedirectPath`). Better Auth's own origin check still runs and
// additionally allows absolute URLs of trusted origins; this guard is
// deliberately stricter: absolute URLs are refused even on our own origin, so
// "internal path" is the one rule A-13 can rely on. Better Auth already
// rejects `//host`/`/\host`/`%2F` variants via `isSafeRelativeURL`; matching
// them here too keeps the contract local to this module.
const INVALID_REDIRECT_MESSAGE = "URL tujuan tidak valid";

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function binziRedirectGuardPlugin(): BetterAuthPlugin {
  const guardBody =
    (fields: string[], code: string) => async (ctx: unknown) => {
      const hook = asHookContext(ctx);
      for (const field of fields) {
        const value = await readBodyField(hook, field);
        if (isBlank(value)) continue;
        if (safeInternalRedirectPath(value) === null) {
          throw new APIError("FORBIDDEN", { code, message: INVALID_REDIRECT_MESSAGE });
        }
      }
      return undefined; // proceed to the endpoint
    };

  const guardQuery = (fields: string[]) => async (ctx: unknown) => {
    const hook = asHookContext(ctx);
    for (const field of fields) {
      const value = readQueryParam(hook, field);
      if (isBlank(value)) continue;
      if (safeInternalRedirectPath(value) === null) {
        throw new APIError("FORBIDDEN", {
          code: "INVALID_CALLBACK_URL",
          message: INVALID_REDIRECT_MESSAGE,
        });
      }
    }
    return undefined; // proceed to the endpoint
  };

  const CALLBACK_FIELDS = ["callbackURL"];

  return {
    id: "binzi-redirect-guard",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN_SOCIAL_PATH,
          handler: guardBody(
            ["callbackURL", "errorCallbackURL", "newUserCallbackURL"],
            "INVALID_CALLBACK_URL",
          ),
        },
        {
          matcher: (ctx) => ctx.path === SEND_VERIFICATION_EMAIL_PATH,
          handler: guardBody(CALLBACK_FIELDS, "INVALID_CALLBACK_URL"),
        },
        {
          matcher: (ctx) => ctx.path === REQUEST_PASSWORD_RESET_PATH,
          handler: guardBody(["redirectTo"], "INVALID_REDIRECT_URL"),
        },
        {
          // The verification link lands as GET with the target in the query.
          matcher: (ctx) => ctx.path === VERIFY_EMAIL_PATH,
          handler: guardQuery(CALLBACK_FIELDS),
        },
        {
          // GET /reset-password/:token — token is in the path, target in query.
          matcher: (ctx) =>
            typeof ctx.path === "string" &&
            ctx.path.startsWith(RESET_PASSWORD_TOKEN_PATH_PREFIX),
          handler: guardQuery(CALLBACK_FIELDS),
        },
      ],
    },
  };
}

/**
 * Pre-hijack kill switch (A-11, decided with the product owner): when a
 * verified OAuth identity meets an UNVERIFIED same-email local account, the
 * link is refused with the stable `account_not_verified` code — and the zombie
 * account is neutralized in the same hook:
 * 1. its credential row is deleted, so a password an attacker set by
 *    registering the email in advance stops working immediately;
 * 2. every session of that account is revoked (belt and braces — unverified
 *    accounts normally hold no session);
 * 3. a fresh verification email is offered through the same 3/hour/email
 *    bucket as the resend endpoint, so the real owner can activate the
 *    account; the NEXT OAuth login then links normally (AUTH-05).
 * `authBaseURL` is Better Auth's CONTEXT base URL (`ctx.context.baseURL`),
 * which includes the base path (`/api/auth`) — the verification route lives
 * there, not at the app root. Failures inside are logged (masked email,
 * §14.2) and swallowed: the refusal itself must never depend on the side
 * effects succeeding.
 */
async function invalidateUnverifiedAccount(
  deps: AuthDeps,
  row: { id: string; email: string; name: string | null },
  authBaseURL: string,
): Promise<void> {
  try {
    await deps.db
      .delete(accounts)
      .where(
        and(
          eq(accounts.userId, row.id),
          eq(accounts.providerId, CREDENTIAL_PROVIDER_ID),
        ),
      );
    await deps.db.delete(sessions).where(eq(sessions.userId, row.id));

    const reservation = await reserveAttempt(
      deps.db,
      verificationEmailRateLimitKey(row.email),
      EMAIL_SEND_RATE_LIMIT.max,
      EMAIL_SEND_RATE_LIMIT.windowSeconds,
    );
    if (!reservation.allowed) return; // still refused, just no new email

    const token = await createEmailVerificationToken(
      deps.secret,
      row.email,
      undefined,
      EMAIL_VERIFICATION_SECONDS,
    );
    // Same shape Better Auth itself sends (email-verification route):
    // `${ctx.context.baseURL}/verify-email?token=…&callbackURL=…`.
    const url = `${authBaseURL}/verify-email?token=${token}&callbackURL=${encodeURIComponent("/")}`;
    await deps.mail.sendVerificationEmail({
      user: { name: row.name, email: row.email },
      url,
      token,
    });
  } catch (error) {
    console.error(
      `[auth] gagal menetralkan akun belum terverifikasi ${maskEmail(row.email)}: ${describeFailure(error)}`,
    );
  }
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Input shape Better Auth hands `user.validateUserInfo` (loosely typed). */
export type OAuthUserInfoInput = {
  user?: { id?: unknown; emailVerified?: unknown };
  source?: {
    method?: string;
    action?: string;
    oauth?: { providerId?: string };
  };
};

/**
 * Resolves Better Auth's CONTEXT base URL (includes the `/api/auth` base
 * path) from the hook context — the value Better Auth itself prefixes email
 * links with. The fallback mirrors Better Auth's default base path, used
 * only when the context value is unreadable.
 */
function authBaseURLFromContext(
  ctx: unknown,
  deps: AuthDeps,
): string {
  const baseURL = asHookContext(ctx).context?.baseURL;
  return typeof baseURL === "string" && baseURL.startsWith("http")
    ? baseURL
    : `${deps.baseURL}/api/auth`;
}

/**
 * A-11 OAuth profile + linking gate (AUTH-02), provider-agnostic and
 * FAIL-CLOSED. Better Auth calls `validateUserInfo` for every user it is
 * about to create, link, or sign in from an OAuth identity:
 *
 * - Profile gate, per provider: Google identities must carry
 *   `email_verified = true` — for new accounts AND linking alike — else the
 *   stable `email_not_verified` refusal. (Other providers keep Better
 *   Auth's own untrusted-provider rule: an unverified profile is never
 *   linked.)
 * - Local-email-verified rule, EVERY provider (`requireLocalEmailVerified`
 *   is off in the options precisely so THIS hook is the gate): on
 *   `link-account`, the local account must exist and be verified. An
 *   unverified account is refused with `account_not_verified` and
 *   neutralized; a missing/unreadable local id or an unknown user is
 *   refused the same way — never allowed through (fail closed).
 * - Non-OAuth sources (the email/password sign-up passes
 *   `{ method: "email-password" }`) pass through untouched.
 */
export function createOAuthUserInfoGate(deps: AuthDeps) {
  return async (
    data: OAuthUserInfoInput,
    ctx?: unknown,
  ): Promise<{ error: string } | undefined> => {
    const source = data.source;
    if (source?.method !== "oauth") return;

    const providerId = source.oauth?.providerId;
    if (providerId === GOOGLE_PROVIDER_ID && data.user?.emailVerified !== true) {
      return { error: GOOGLE_EMAIL_NOT_VERIFIED_CODE };
    }

    if (source.action !== "link-account") return;

    // `id` is the local user's id on this path (link-account.mjs sets it).
    const localId = typeof data.user?.id === "string" ? data.user.id : "";
    if (localId) {
      const rows = await deps.db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(eq(users.id, localId))
        .limit(1);
      const local = rows[0];
      if (local?.emailVerified) return; // verified local account: link away
      if (local) {
        await invalidateUnverifiedAccount(
          deps,
          local,
          authBaseURLFromContext(ctx, deps),
        );
        return { error: ACCOUNT_NOT_VERIFIED_CODE };
      }
    }
    // No readable local id, or no such user: refuse rather than link blind.
    return { error: ACCOUNT_NOT_VERIFIED_CODE };
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
      /**
       * A-11 profile + linking gate — see `createOAuthUserInfoGate` (exported
       * for unit tests of the fail-closed branches).
       */
      validateUserInfo: createOAuthUserInfoGate(deps),
    },
    account: {
      // §12: OAuth access/refresh tokens are secrets — never stored in
      // plaintext. Better Auth encrypts them (xchacha20-poly1305, key derived
      // from the auth secret; `$ba$…` envelope) and decrypts on read itself.
      encryptOAuthTokens: true,
      accountLinking: {
        // The local-email-verified rule is enforced by `user.validateUserInfo`
        // (action "link-account") instead of here: Better Auth's built-in gate
        // runs BEFORE the hook and would answer a pre-hijack attempt with a
        // generic `account_not_linked`, skipping the neutralization and the
        // stable `account_not_verified` code A-13 maps to copy. The
        // replacement gate in `createOAuthUserInfoGate` covers EVERY OAuth
        // provider (this option is global) and fails closed — a missing local
        // id or an unknown user is refused, never linked. The provider-side
        // rule stays with Better Auth: `trustedProviders` is empty, so an
        // untrusted provider's profile must itself be email-verified to link.
        requireLocalEmailVerified: false,
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
      user: {
        create: {
          after: async (created) => {
            // NTF-01 welcome for Google-created accounts (A-11): they never
            // pass the A-10 verification event. Credential sign-ups are always
            // created with emailVerified=false (requireEmailVerification) and
            // AUTH-05 linking creates no user row, so `emailVerified === true`
            // here can only be a fresh Google sign-up. The callback swallows
            // all mail failures; awaiting adds latency to the signup insert
            // but keeps delivery reliable in serverless.
            if (created.emailVerified) {
              await deps.mail.sendWelcome({
                name: created.name,
                email: created.email,
              });
            }
          },
        },
      },
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
      binziRedirectGuardPlugin(),
    ],
    ...(deps.socialProviders ? { socialProviders: deps.socialProviders } : {}),
  });
}

export type AuthInstance = ReturnType<typeof createAuthInstance>;

/** Exposed for tests asserting bucket-key normalization. */
export { normalizeEmail };
