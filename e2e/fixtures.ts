// Shared E2E fixtures & helpers (card A-19 §3).
//
// - Test-account rule (CLAUDE.md): passwords are generated at RUNTIME
//   (never a literal in e2e/**) and every address is unique on
//   @example.com, so each test owns a fresh rate-limit bucket.
// - Role accounts are created through the REAL sign-up endpoint (Turnstile
//   test token in x-captcha-response), then verified and promoted directly
//   in the E2E database. scripts/set-role.ts is NOT imported here — the
//   module's top-level import.meta breaks under Playwright's CJS worker
//   transform — it runs as a child process instead, BEFORE the account ever
//   signs in (the script revokes all sessions).
// - CSP: every page load is watched; securitypolicyviolation events are
//   forwarded to Node via exposeBinding (an array on `window` would vanish
//   on navigation) and asserted after the test body.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Sql } from "postgres";

import { E2E_DATABASE_URL } from "./env";
// Same callback the app's register form sends (register-form.tsx) — without
// it the verification link falls back to callbackURL=/ and error redirects
// land on the homepage instead of /daftar/verifikasi.
import { VERIFICATION_CALLBACK_PATH } from "../src/modules/auth/schema";

// ---------------------------------------------------------------- accounts

let emailCounter = 0;

/** Unique per-test address on the CLAUDE.md test-account domain. */
export function uniqueEmail(prefix = "t"): string {
  const stamp = Date.now().toString(36);
  const nonce = randomBytes(3).toString("hex");
  return `e2e-${prefix}.${stamp}.${(emailCounter++).toString(36)}.${nonce}@example.com`;
}

/**
 * Random password meeting AUTH-01 (>= 8 chars, letters + digits). Built so
 * letters AND digits are guaranteed by construction, not by chance.
 */
export function randomPassword(): string {
  return `E2e-${randomBytes(9).toString("hex")}-9a`;
}

// Cloudflare's always-pass test sitekey/secret pair make ANY token value
// pass siteverify; this is the dummy token the tests send in
// x-captcha-response (card A-19 §3).
export const DUMMY_CAPTCHA_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** Realistic browser headers for the Better Auth endpoints. */
export function authHeaders(): Record<string, string> {
  return {
    "x-captcha-response": DUMMY_CAPTCHA_TOKEN,
    Origin: "http://localhost:3100",
  };
}

// -------------------------------------------------------------------- db

/** One short-lived connection to the E2E database (guard already ran). */
export async function withE2eDb<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(E2E_DATABASE_URL, { max: 1, prepare: false });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Marks an account as email-verified directly in the E2E database. */
export async function markVerifiedInE2eDb(email: string): Promise<void> {
  await withE2eDb((sql) => sql`
    update users set email_verified = true where email = ${email}
  `);
}

/**
 * `setUserRole` from scripts/set-role.ts as a CHILD PROCESS (session
 * decision #1): the module cannot be imported under Playwright's worker
 * transform. DATABASE_URL in the child's env is the guarded E2E URL, and
 * the script is invoked with plain tsx — NOT `npm run user:role`, which
 * would load `.env.local`. Must run BEFORE the account signs in: the script
 * revokes every session.
 */
export function setRoleViaScript(email: string, role: UserRole): void {
  // process.cwd() (not import.meta — see the CJS note in mail-log.ts):
  // Playwright workers run from the project root.
  const script = resolve(process.cwd(), "scripts/set-role.ts");
  const child = spawnSync("npx", ["tsx", script, email, role], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });
  if (child.status !== 0) {
    throw new Error(
      `set-role.ts failed for ${role}: ${child.stdout ?? ""}${child.stderr ?? ""}`,
    );
  }
}

export type UserRole = "MEMBER" | "EDITOR" | "ADMIN" | "SUPER_ADMIN";

export type TestAccount = {
  email: string;
  password: string;
  role: UserRole;
};

/** Sign up through the real endpoint (Turnstile test token in the header). */
export async function signUpViaApi(
  request: APIRequestContext,
  account: { name: string; email: string; password: string },
): Promise<void> {
  const response = await request.post("/api/auth/sign-up/email", {
    headers: authHeaders(),
    data: { ...account, callbackURL: VERIFICATION_CALLBACK_PATH },
  });
  expect(response.status(), await response.text()).toBe(200);
}

/**
 * Verified account with a role, created end-to-end: real sign-up →
 * verify flag in the E2E DB → set-role child process (before any sign-in).
 */
export async function createRoleAccount(
  request: APIRequestContext,
  role: UserRole,
): Promise<TestAccount> {
  const account = {
    name: `E2E ${role}`,
    email: uniqueEmail(role.toLowerCase()),
    password: randomPassword(),
  };
  await signUpViaApi(request, account);
  await markVerifiedInE2eDb(account.email);
  setRoleViaScript(account.email, role);
  return { ...account, role };
}

/** Signs an account in through the API; cookies land in the context. */
export async function signInViaApi(
  context: BrowserContext,
  account: { email: string; password: string },
): Promise<void> {
  const response = await context.request.post("/api/auth/sign-in/email", {
    headers: authHeaders(),
    data: { email: account.email, password: account.password },
  });
  expect(response.status(), await response.text()).toBe(200);
}

// -------------------------------------------------------------------- CSP

export type CspViolation = {
  directive: string;
  blockedURI: string;
  sourceFile: string;
};

/**
 * The ONE allowed violation (card A-19 §3): zod's feature probe calls eval
 * from bundled code under /_next/static/ (directive script-src, blockedURI
 * eval). Tracked as a STATUS chore (zod `jitless`); everything else fails
 * the test.
 */
const ZOD_EVAL_PROBE_EXCEPTION = {
  directive: "script-src",
  blockedURI: "eval",
  sourceFileIncludes: "/_next/static/",
} as const;

function isZodEvalProbe(violation: CspViolation): boolean {
  return (
    violation.directive === ZOD_EVAL_PROBE_EXCEPTION.directive &&
    violation.blockedURI === ZOD_EVAL_PROBE_EXCEPTION.blockedURI &&
    violation.sourceFile.includes(ZOD_EVAL_PROBE_EXCEPTION.sourceFileIncludes)
  );
}

/** Fails on any CSP violation except the zod eval probe. */
export function expectNoCspViolations(violations: CspViolation[]): void {
  const real = violations.filter((v) => !isZodEvalProbe(v));
  expect(
    real,
    "CSP violations under the production policy (attribution from " +
      "sourceFile/blockedURI, not the page the event surfaced on):\n" +
      JSON.stringify(real, null, 2),
  ).toEqual([]);
}

/**
 * Installs the CSP collector on a context: every securitypolicyviolation
 * event (any frame, any navigation — init scripts re-run per document) is
 * forwarded to Node and collected in the returned array. Attribution comes
 * from sourceFile/blockedURI (A-16b lesson).
 */
export async function attachCspCollector(
  context: BrowserContext,
): Promise<CspViolation[]> {
  const violations: CspViolation[] = [];
  await context.exposeBinding("__e2eCspViolation", (_source, violation) => {
    violations.push(violation as CspViolation);
  });
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as {
        __e2eCspViolation: (v: unknown) => void;
      }).__e2eCspViolation({
        directive: event.effectiveDirective ?? event.violatedDirective ?? "",
        blockedURI: event.blockedURI ?? "",
        sourceFile: event.sourceFile ?? "",
      });
    });
  });
  return violations;
}

/**
 * Extra context WITH the CSP collector (session decision #6): use for the
 * second browser context in the session-revocation test and the per-role
 * contexts. Call expectNoCspViolations on the result when pages were opened.
 */
export async function newCollectedContext(
  browser: import("@playwright/test").Browser,
): Promise<{ context: BrowserContext; violations: CspViolation[] }> {
  const context = await browser.newContext();
  const violations = await attachCspCollector(context);
  return { context, violations };
}

// ------------------------------------------------------------------ test

/**
 * The `page` fixture: a fresh context with the CSP collector attached and
 * the no-violations assertion running right after the test body.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { context, violations } = await newCollectedContext(browser);
    const page = await context.newPage();
    await use(page);
    expectNoCspViolations(violations);
    await context.close();
  },
});

export { expect };
