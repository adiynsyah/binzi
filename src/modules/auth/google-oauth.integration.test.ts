// Integration tests for Google OAuth (card A-11 "Selesai jika").
//
// Same harness family as better-auth.integration.test.ts: in-process
// Postgres (PGlite) + committed migrations + `auth.handler(Request)`, with
// the Google provider replaced by an in-memory fake — no network, no real
// Google account. The fake is injected by patching the provider FACTORY table
// Better Auth consults when normalizing `socialProviders` options
// (dist/context/create-context.mjs), so every other layer exercised here is
// the real one: state handling, the /callback/google route, implicit
// account linking, and the Better Auth defaults behind AUTH-05.
//
// Covers: fresh Google sign-up (role MEMBER, emailVerified, session, welcome
// email, redirect back to the origin page §14.2), linking to a VERIFIED
// email/password account (one user, credential + google rows), the
// pre-hijack refusal on an UNVERIFIED local account (no link, credential
// deleted, sessions revoked, fresh verification email offered, old password
// dead), recovery through the verification link EXACTLY as emailed (base
// path included) + a later password reset, rejection of email_verified=false
// profiles, the 3/hour resend cap on the refusal path, the same refusal via
// a NON-google provider plus the fail-closed unit branches (missing/unknown
// local id), and the internal-path redirect guard on all five entry points.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import * as coreSocialProviders from "@better-auth/core/social-providers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "../../db/schema";
import { accounts, sessions, users } from "../../db/schema";
import type { Db } from "../../db/client";
import type { MailMessage } from "../../lib/mail";
import {
  createAuthInstance,
  createOAuthUserInfoGate,
  type AuthDeps,
  type AuthInstance,
} from "./better-auth";
import { createMailCallbacks } from "./email-senders";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const BASE = "https://binzi-test.example.com";
const TEST_PASSWORD = "Gizi1234";
const NEW_PASSWORD = "Baru12345";
const GOOGLE_CLIENT_ID = "test-google-client-id";
const GOOGLE_CLIENT_SECRET = "test-google-client-secret";
const WELCOME_SUBJECT_PREFIX = "Selamat datang di BINZI";

// The fake Google profile served by the patched provider; tests reassign
// fields before driving the flow. `facebookProfile` belongs to a second,
// patched provider that stands in for "any non-google OAuth provider" in
// the provider-agnostic fail-closed tests.
const googleProfile = {
  sub: "google-sub-1",
  email: "fresh.google@example.com",
  email_verified: true,
  name: "Gita Google",
  picture: "https://photos.example/g.jpg",
};
const facebookProfile = {
  sub: "facebook-sub-1",
  email: "fresh.facebook@example.com",
  email_verified: true,
  name: "Fani Facebook",
  picture: "https://photos.example/f.jpg",
};

// Replace the `google`/`facebook` entries in the provider FACTORY TABLE
// Better Auth consults when normalizing `socialProviders` options
// (dist/context/create-context.mjs). A vi.mock of this module would NOT
// reach that code: better-auth is externalized by Vitest, so its imports
// resolve natively and bypass the mock registry. Mutating the shared table
// object does reach it (same module instance in Node's registry), while
// every other layer exercised here stays real: state handling, the
// /callback/:provider route, implicit account linking, and the Better Auth
// defaults behind AUTH-05.
function fakeOAuthFactory(providerId: string, profile: typeof googleProfile) {
  return (config: unknown) => ({
    id: providerId,
    name: providerId,
    // Real Google resolves the account key from the profile `sub`.
    accountSubject: ({ profile: p }: { profile: { sub: string } }) => p.sub,
    createAuthorizationURL: async ({ state }: { state: string }) =>
      new URL(`https://fake.${providerId}.example/auth?state=${state}`),
    validateAuthorizationCode: async () => ({
      accessToken: "fake-access-token",
      idToken: "fake-id-token",
    }),
    getUserInfo: async () => ({
      user: {
        name: profile.name,
        email: profile.email,
        image: profile.picture,
        emailVerified: profile.email_verified,
      },
      data: { ...profile },
    }),
    options: config,
  });
}

const realGoogleFactory = coreSocialProviders.socialProviders.google;
const realFacebookFactory = coreSocialProviders.socialProviders.facebook;
coreSocialProviders.socialProviders.google = fakeOAuthFactory(
  "google",
  googleProfile,
) as unknown as typeof realGoogleFactory;
coreSocialProviders.socialProviders.facebook = fakeOAuthFactory(
  "facebook",
  facebookProfile,
) as unknown as typeof realFacebookFactory;
afterAll(() => {
  coreSocialProviders.socialProviders.google = realGoogleFactory;
  coreSocialProviders.socialProviders.facebook = realFacebookFactory;
});

let pglite: PGlite;
let db: Db;
let deps: AuthDeps;
let auth: AuthInstance;
/** The same gate `createAuthInstance` wires — driven directly for the unit tests. */
let gate: ReturnType<typeof createOAuthUserInfoGate>;
const sent: MailMessage[] = [];

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/migrations", import.meta.url),
    ),
  });
  db = pgliteDb as unknown as Db;

  const mail = createMailCallbacks(
    async (message) => {
      sent.push(message);
    },
    { appUrl: BASE },
  );
  deps = {
    db,
    secret: "integration-test-secret-0123456789abcdef",
    baseURL: BASE,
    trustedOrigins: [BASE],
    captcha: null, // Turnstile behavior is covered by the A-09 suite
    mail,
    socialProviders: {
      google: {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
      },
      facebook: {
        clientId: "test-facebook-client-id",
        clientSecret: "test-facebook-client-secret",
      },
    },
  };
  auth = createAuthInstance(deps);
  gate = createOAuthUserInfoGate(deps);
});

afterAll(async () => {
  await pglite.close();
});

function post(path: string, body: Record<string, unknown>): Promise<Response> {
  return auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify(body),
    }),
  );
}

function get(path: string): Promise<Response> {
  return getRaw(`${BASE}/api/auth${path}`);
}

/** GETs an absolute URL (e.g. an email link) against the handler, as-is. */
function getRaw(url: string | URL): Promise<Response> {
  return auth.handler(
    new Request(url, {
      method: "GET",
      headers: { origin: BASE },
    }),
  );
}

/** Collects `name=value` pairs from a response's Set-Cookie headers. */
function cookieHeaderFrom(response: Response): string {
  const setCookies =
    response.headers.getSetCookie?.() ??
    (response.headers.get("set-cookie")
      ? [response.headers.get("set-cookie") as string]
      : []);
  return setCookies
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/**
 * Drives the full redirect flow for a provider: initiation → provider →
 * callback. The callback must replay the initiation's cookies — Better Auth
 * pairs the `state` query param with a signed state cookie (CSRF double
 * submit), so without them the callback answers `state_mismatch`.
 */
async function oauthLogin(
  provider: string,
  callbackURL = "/materi/2",
): Promise<Response> {
  const initiation = await post("/sign-in/social", {
    provider,
    callbackURL,
  });
  if (initiation.status !== 200) return initiation;
  const cookie = cookieHeaderFrom(initiation);
  const { url } = (await initiation.json()) as { url?: string };
  const state = new URL(url ?? "").searchParams.get("state");
  return auth.handler(
    new Request(
      `${BASE}/api/auth/callback/${provider}?code=fake-code&state=${encodeURIComponent(state ?? "")}`,
      {
        method: "GET",
        headers: { origin: BASE, ...(cookie ? { cookie } : {}) },
      },
    ),
  );
}

/** Google-specific convenience over `oauthLogin`. */
function googleLogin(callbackURL = "/materi/2"): Promise<Response> {
  return oauthLogin("google", callbackURL);
}

async function signUp(
  email: string,
  password = TEST_PASSWORD,
): Promise<Response> {
  return post("/sign-up/email", { name: "Rina Tester", email, password });
}

async function markVerified(email: string): Promise<void> {
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.email, email));
}

async function userByEmail(email: string) {
  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0];
}

async function accountRows(userId: string) {
  return db
    .select({ providerId: accounts.providerId, accountId: accounts.accountId })
    .from(accounts)
    .where(eq(accounts.userId, userId));
}

function welcomeEmailsTo(email: string): MailMessage[] {
  return sent.filter(
    (message) =>
      message.to === email && message.subject.startsWith(WELCOME_SUBJECT_PREFIX),
  );
}

function verificationEmailsTo(email: string): MailMessage[] {
  return sent.filter(
    (message) => message.to === email && message.link?.includes("/verify-email"),
  );
}

/** Extracts the verification token from the latest verification email link. */
function latestVerificationToken(email: string): string {
  const message = verificationEmailsTo(email).at(-1);
  const url = new URL(message?.link ?? "");
  return url.searchParams.get("token") ?? "";
}

describe("A-11 Google OAuth (PGlite, mocked provider)", () => {
  it("creates a MEMBER account, welcomes, and returns to the origin page (§14.2)", async () => {
    const email = "fresh.google@example.com";
    Object.assign(googleProfile, { sub: "google-sub-fresh", email });

    const response = await googleLogin("/materi/2");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/materi/2");
    // Session cookie is set on the callback response.
    expect(response.headers.get("set-cookie")).toContain(
      "better-auth.session_token",
    );

    const user = await userByEmail(email);
    expect(user).toBeDefined();
    expect(user?.role).toBe("MEMBER");
    expect(user?.emailVerified).toBe(true);

    const linked = await accountRows(user!.id);
    expect(linked).toEqual([
      { providerId: "google", accountId: "google-sub-fresh" },
    ]);

    // Welcome email (c): Google accounts skip the A-10 verification event.
    expect(welcomeEmailsTo(email)).toHaveLength(1);
  });

  it("links a verified email/password account instead of duplicating (AUTH-05)", async () => {
    const email = "linked.local@example.com";
    await signUp(email);
    await markVerified(email);
    const before = await userByEmail(email);

    Object.assign(googleProfile, { sub: "google-sub-linked", email });
    const response = await googleLogin("/materi/2");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/materi/2");

    const after = await userByEmail(email);
    expect(after?.id).toBe(before?.id); // same user row, not a second one

    const linked = await accountRows(after!.id);
    expect(new Set(linked.map((a) => a.providerId))).toEqual(
      new Set(["credential", "google"]),
    );
    expect(linked.find((a) => a.providerId === "google")?.accountId).toBe(
      "google-sub-linked",
    );

    // No welcome email: linking creates no user row — the welcome belongs to
    // the A-10 verification event this account never went through here.
    expect(welcomeEmailsTo(email)).toHaveLength(0);
  });

  it("refuses an unverified local account and neutralizes it (pre-hijack)", async () => {
    const email = "pre.hijack@example.com";
    const signup = await signUp(email);
    expect(signup.status).toBe(200);
    const user = await userByEmail(email);
    expect(user?.emailVerified).toBe(false);
    expect(verificationEmailsTo(email)).toHaveLength(1); // sendOnSignUp

    // A leftover session from before (belt and braces: requireEmailVerification
    // already prevents real ones) proves the revocation below.
    await db.insert(sessions).values({
      id: "stale-session-id",
      userId: user!.id,
      token: "stale-session-token",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    Object.assign(googleProfile, { sub: "google-sub-hijack", email });
    const response = await googleLogin();
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/error");
    expect(location).toContain("error=account_not_verified");

    // No linking, no duplicate — one user, zero account rows.
    expect(await userByEmail(email)).toMatchObject({ id: user!.id });
    expect(await accountRows(user!.id)).toEqual([]); // credential deleted

    // The pre-hijack password is dead, and so is every session.
    const passwordSignIn = await post("/sign-in/email", {
      email,
      password: TEST_PASSWORD,
    });
    expect(passwordSignIn.status).toBe(401);
    const remaining = await db
      .select({ token: sessions.token })
      .from(sessions)
      .where(eq(sessions.userId, user!.id));
    expect(remaining).toEqual([]);

    // …and a fresh verification email was offered (1st use of the bucket).
    expect(verificationEmailsTo(email)).toHaveLength(2);
    expect(latestVerificationToken(email)).not.toBe("");
  });

  it("recovers via verification, links on the next login, and a reset restores the password", async () => {
    const email = "recover.after.hijack@example.com";
    await signUp(email); // unverified local account
    Object.assign(googleProfile, { sub: "google-sub-recover", email });
    const refused = await googleLogin();
    expect(refused.headers.get("location")).toContain(
      "error=account_not_verified",
    );

    // The owner clicks the verification link EXACTLY as delivered: the URL
    // from the captured email must carry the Better Auth base path and
    // resolve against the handler as-is (a link to the bare app root 404s).
    const link = verificationEmailsTo(email).at(-1)?.link;
    expect(link).toBeTruthy();
    expect(link).toContain(`${BASE}/api/auth/verify-email?`);
    const verified = await getRaw(link!);
    expect(verified.status).toBeLessThan(400);
    expect(await userByEmail(email)).toMatchObject({ emailVerified: true });

    // Next Google login now links to the SAME user (still exactly one row).
    const linked = await googleLogin("/materi/2");
    expect(linked.status).toBe(302);
    expect(linked.headers.get("location")).toContain("/materi/2");
    const user = await userByEmail(email);
    expect(user).toBeDefined();
    const rows = await accountRows(user!.id);
    expect(rows.map((r) => r.providerId)).toEqual(["google"]); // credential stays dead

    // Owner sets a fresh password through the A-10 reset flow → back to 2 rows.
    const resetRequest = await post("/request-password-reset", {
      email,
      redirectTo: "/masuk",
    });
    expect(resetRequest.status).toBe(200);
    const resetMail = sent
      .filter((m) => m.to === email && m.link?.includes("/reset-password/"))
      .at(-1);
    const resetToken = new URL(resetMail?.link ?? "").pathname.split("/").pop();
    expect(resetToken).toBeTruthy();
    const reset = await post("/reset-password", {
      token: resetToken,
      newPassword: NEW_PASSWORD,
    });
    expect(reset.status).toBe(200);

    const afterReset = await accountRows(user!.id);
    expect(new Set(afterReset.map((a) => a.providerId))).toEqual(
      new Set(["google", "credential"]),
    );
    const signIn = await post("/sign-in/email", {
      email,
      password: NEW_PASSWORD,
    });
    expect(signIn.status).toBe(200);
  });

  it("rejects a Google profile with email_verified=false and creates nothing", async () => {
    const email = "unverified.google@example.com";
    Object.assign(googleProfile, {
      sub: "google-sub-unverified-email",
      email,
      email_verified: false,
    });

    const response = await googleLogin();
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("error=email_not_verified");

    expect(await userByEmail(email)).toBeUndefined();
    const googleRow = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.providerId, "google"),
          eq(accounts.accountId, "google-sub-unverified-email"),
        ),
      );
    expect(googleRow).toEqual([]);
  });

  it("caps the refusal-path verification resend at the shared 3/hour bucket", async () => {
    const email = "rate.limited@example.com";
    await signUp(email); // sendOnSignUp email — outside the resend bucket
    // Restore email_verified: the previous test left it false.
    Object.assign(googleProfile, {
      sub: "google-sub-ratelimit",
      email,
      email_verified: true,
    });

    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await googleLogin();
      expect(response.headers.get("location")).toContain(
        "error=account_not_verified",
      );
    }
    // 1 signup email + 3 rate-limited refusals; the 4th sends nothing.
    expect(verificationEmailsTo(email)).toHaveLength(4);
  });

  it("applies the same pre-hijack refusal to a NON-google provider (fail-closed, provider-agnostic)", async () => {
    // `requireLocalEmailVerified: false` is global — so the hook must carry
    // the local-verified rule for every OAuth provider, not just google.
    const email = "pre.hijack.facebook@example.com";
    await signUp(email);
    const user = await userByEmail(email);
    expect(user?.emailVerified).toBe(false);

    Object.assign(facebookProfile, { sub: "facebook-sub-hijack", email });
    const response = await oauthLogin("facebook");
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("error=account_not_verified");

    // Not linked, no duplicate user — and the zombie credential is dead.
    expect(await userByEmail(email)).toMatchObject({ id: user!.id });
    expect(await accountRows(user!.id)).toEqual([]);
    const passwordSignIn = await post("/sign-in/email", {
      email,
      password: TEST_PASSWORD,
    });
    expect(passwordSignIn.status).toBe(401);
    // Signup email + the refusal's fresh verification offer.
    expect(verificationEmailsTo(email)).toHaveLength(2);
  });

  it("rejects external redirect targets on every entry point (open redirect)", async () => {
    const variants = [
      "https://evil.com/x",
      `https://binzi-test.example.com/materi/2`, // own origin — still refused
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "%2F%2Fevil.com",
    ];
    for (const callbackURL of variants) {
      const response = await post("/sign-in/social", {
        provider: "google",
        callbackURL,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get("location")).toBeNull();
    }

    // A-10 entry points, same rule.
    const sendVerification = await post("/send-verification-email", {
      email: "redirect.guard@example.com",
      callbackURL: `https://binzi-test.example.com/materi/2`,
    });
    expect(sendVerification.status).toBeGreaterThanOrEqual(400);

    const requestReset = await post("/request-password-reset", {
      email: "redirect.guard@example.com",
      redirectTo: "//evil.com",
    });
    expect(requestReset.status).toBeGreaterThanOrEqual(400);

    const verifyEmail = await get(
      `/verify-email?token=anything&callbackURL=${encodeURIComponent("https://evil.com")}`,
    );
    expect(verifyEmail.status).toBeGreaterThanOrEqual(400);

    const resetCallback = await get(
      `/reset-password/some-token?callbackURL=${encodeURIComponent("https://evil.com")}`,
    );
    expect(resetCallback.status).toBeGreaterThanOrEqual(400);
  });

  it("keeps our own INVALID_CALLBACK_URL code for targets Better Auth's origin check alone would allow", async () => {
    const response = await post("/sign-in/social", {
      provider: "google",
      callbackURL: `${BASE}/materi/2`, // trusted origin → passes origin check
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("INVALID_CALLBACK_URL");
  });
});

describe("createOAuthUserInfoGate — fail-closed branches (unit, same deps)", () => {
  it("refuses link-account when the local id is missing or unknown", async () => {
    const sentBefore = sent.length;

    // Missing local id → refused (never allowed through).
    const missing = await gate({
      user: { emailVerified: true },
      source: {
        method: "oauth",
        action: "link-account",
        oauth: { providerId: "google" },
      },
    });
    expect(missing).toEqual({ error: "account_not_verified" });

    // Unknown local id → refused the same way.
    const unknown = await gate({
      user: { id: "no-such-user-id", emailVerified: true },
      source: {
        method: "oauth",
        action: "link-account",
        oauth: { providerId: "google" },
      },
    });
    expect(unknown).toEqual({ error: "account_not_verified" });

    // Nothing to neutralize in either case — no mail side effects.
    expect(sent.length).toBe(sentBefore);
  });

  it("lets non-OAuth sources through untouched", async () => {
    const result = await gate({
      user: { id: "whatever", emailVerified: false },
      source: { method: "email-password" },
    });
    expect(result).toBeUndefined();
  });
});

describe("real Google provider factory scope (no network)", () => {
  it("requests exactly openid email profile", async () => {
    const { google } = await import("better-auth/social-providers");
    const provider = google({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    });
    const url = await provider.createAuthorizationURL({
      state: "state-value",
      codeVerifier: "c".repeat(43),
      redirectURI: `${BASE}/api/auth/callback/google`,
    });
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual([
      "email",
      "openid",
      "profile",
    ]);
  });
});
