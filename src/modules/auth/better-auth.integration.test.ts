// Integration tests for the Better Auth core (card A-09 "Selesai jika").
//
// Boots an in-process Postgres (PGlite), applies the committed Drizzle
// migrations with the official migrator, and drives the real auth instance
// through `auth.handler(Request)` — the same entry point the route handler
// uses. Cloudflare siteverify is pointed at a loopback mock, so nothing
// here touches the network, binzi-dev, or Turnstile itself.
//
// Covers: registration (role locked to MEMBER), login, identical failure
// messages (unknown email vs wrong password vs blocked), the 5-per-15-min
// bucket on `rate_limits` (atomic reservation — including under a parallel
// burst — plus reset on success and window expiry), Turnstile rejection
// that never reaches the bucket, fixed session windows (member 30 days /
// staff 8 hours), and cookie attributes.
//
// Since A-10 (`requireEmailVerification: true`) a sign-up creates no
// session — tests that sign in flip `emailVerified` straight in the DB via
// `signUpVerified`, standing in for a completed verification link. The
// verification/reset flows themselves live in email.integration.test.ts.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "../../db/schema";
import { rateLimits, sessions, users } from "../../db/schema";
import type { Db } from "../../db/client";
import {
  loginRateLimitKey,
  passwordResetRateLimitKey,
  verificationEmailRateLimitKey,
} from "../../lib/ratelimit";
import type { MailMessage } from "../../lib/mail";
import {
  LOGIN_BLOCKED_MESSAGE,
  LOGIN_FAILED_MESSAGE,
  createAuthInstance,
  type AuthInstance,
} from "./better-auth";
import { createMailCallbacks } from "./email-senders";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const BASE_HTTPS = "https://binzi-test.example.com";
const BASE_HTTP = "http://localhost:3000";
const VALID_CAPTCHA = "valid-captcha-token";
const TEST_PASSWORD = "Gizi1234";
const WRONG_PASSWORD = "Salah123";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Loopback mock of challenges.cloudflare.com/turnstile/v0/siteverify:
// exactly one token passes, everything else fails.
const siteVerify = await new Promise<{ server: Server; url: string }>(
  (resolve) => {
    const server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        let token: unknown;
        try {
          token = (JSON.parse(raw) as { response?: unknown }).response;
        } catch {
          token = undefined;
        }
        const ok = token === VALID_CAPTCHA;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify(
            ok
              ? { success: true }
              : { success: false, "error-codes": ["invalid-input-response"] },
          ),
        );
      });
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/siteverify`,
      });
    });
  },
);

let pglite: PGlite;
let db: Db;
let authHttps: AuthInstance;
let authHttp: AuthInstance;

// In-memory mail capture — the A-09 flows only need the callbacks to exist.
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

  const captcha = {
    secretKey: "test-key",
    siteVerifyURLOverride: siteVerify.url,
  };
  const mail = createMailCallbacks(
    async (message) => {
      sent.push(message);
    },
    { appUrl: BASE_HTTPS },
  );
  authHttps = createAuthInstance({
    db,
    secret: "integration-test-secret-0123456789abcdef",
    baseURL: BASE_HTTPS,
    trustedOrigins: [BASE_HTTPS],
    captcha,
    mail,
  });
  authHttp = createAuthInstance({
    db,
    secret: "integration-test-secret-0123456789abcdef",
    baseURL: BASE_HTTP,
    trustedOrigins: [BASE_HTTP],
    captcha,
    mail,
  });
});

afterAll(async () => {
  await pglite.close();
  siteVerify.server.close();
});

type CallOptions = {
  body?: Record<string, unknown>;
  ip?: string;
  /** null sends the request WITHOUT x-captcha-response (AUTH-10 case). */
  captcha?: string | null;
};

function callAuth(
  auth: AuthInstance,
  baseURL: string,
  path: string,
  { body, ip, captcha = VALID_CAPTCHA }: CallOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin: baseURL,
  };
  // `captcha: null` sends NO header at all — the "request without
  // x-captcha-response" case (AUTH-10). (Explicit `undefined` would just
  // re-trigger the default parameter.)
  if (captcha !== null && captcha !== undefined) {
    headers["x-captcha-response"] = captcha;
  }
  if (ip) headers["x-forwarded-for"] = ip;
  return auth.handler(
    new Request(`${baseURL}/api/auth${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    }),
  );
}

const signIn = (
  auth: AuthInstance,
  email: string,
  password: string,
  ip: string,
  captcha?: string,
) =>
  callAuth(auth, BASE_HTTPS, "/sign-in/email", {
    body: { email, password },
    ip,
    captcha,
  });

const signUp = (
  auth: AuthInstance,
  email: string,
  password: string,
  ip: string,
  extra: Record<string, unknown> = {},
) =>
  callAuth(auth, BASE_HTTPS, "/sign-up/email", {
    body: { name: "Rina Tester", email, password, ...extra },
    ip,
  });

/**
 * Sign-up + straight-DB verification flip: stands in for a completed
 * verification link so login-flow tests stay about login (the flows
 * themselves are covered by email.integration.test.ts).
 */
async function signUpVerified(
  auth: AuthInstance,
  email: string,
  password: string,
  ip: string,
  extra: Record<string, unknown> = {},
) {
  const response = await signUp(auth, email, password, ip, extra);
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.email, email));
  return response;
}

async function errorBody(
  response: Response,
): Promise<{ code?: string; message?: string }> {
  return (await response.json()) as { code?: string; message?: string };
}

async function latestSessionByToken(token: string) {
  const rows = await db
    .select({
      token: sessions.token,
      expiresAt: sessions.expiresAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);
  return rows[0];
}

describe("A-09 Better Auth core (PGlite)", () => {
  it("registers a user with role MEMBER / status ACTIVE — and, since A-10, no session", async () => {
    const email = "member1@example.com";
    const response = await signUp(
      authHttps,
      email,
      TEST_PASSWORD,
      "198.51.100.1",
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      token?: string;
      user?: { email?: string };
    };
    expect(json.user?.email).toBe(email);

    const row = (
      await db
        .select({ role: users.role, status: users.status })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    )[0];
    expect(row?.role).toBe("MEMBER");
    expect(row?.status).toBe("ACTIVE");

    // requireEmailVerification: no session is issued at sign-up.
    expect(json.token).toBeNull();
    expect(
      await db
        .select({ id: sessions.id })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(users.email, email)),
    ).toHaveLength(0);
  });

  it("rejects a smuggled role at registration and creates nothing", async () => {
    const email = "smuggle@example.com";
    const response = await signUp(
      authHttps,
      email,
      TEST_PASSWORD,
      "198.51.100.2",
      {
        role: "ADMIN",
      },
    );

    expect(response.status).toBe(400);
    expect((await errorBody(response)).message).toMatch(/not allowed/i);

    const rows = await db.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(0);
  });

  it("enforces the AUTH-01 letter+digit policy server-side", async () => {
    const response = await signUp(
      authHttps,
      "weakpass@example.com",
      "tanpaangka",
      "198.51.100.3",
    );

    expect(response.status).toBe(400);
    expect((await errorBody(response)).message).toBe(
      "Kata sandi harus mengandung angka",
    );
  });

  it("returns the identical message for unknown email and wrong password (§14.2)", async () => {
    const ip = "198.51.100.10";

    const wrongPassword = await signIn(
      authHttps,
      "member1@example.com",
      WRONG_PASSWORD,
      ip,
    );
    const unknownEmail = await signIn(
      authHttps,
      "tidakada@example.com",
      "Apapun123",
      ip,
    );

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);

    const wrongBody = await errorBody(wrongPassword);
    const unknownBody = await errorBody(unknownEmail);
    expect(wrongBody.message).toBe(LOGIN_FAILED_MESSAGE);
    expect(unknownBody.message).toBe(wrongBody.message);
  });

  it("blocks the 6th failed sign-in (429) with the rate-limit message, then re-allows after the window (AUTH-08 / V-10)", async () => {
    const email = "victim@example.com";
    const ip = "203.0.113.50";

    const registered = await signUp(
      authHttps,
      email,
      TEST_PASSWORD,
      "203.0.113.51",
    );
    expect(registered.status).toBe(200);

    // AUTH-08: locked AFTER 5 attempts — five credential failures still
    // answer 401 (with the §14.2 no-leak copy); only the SIXTH is 429.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await signIn(authHttps, email, WRONG_PASSWORD, ip);
      expect(response.status).toBe(401);
      expect((await errorBody(response)).message).toBe(LOGIN_FAILED_MESSAGE);
    }

    const sixth = await signIn(authHttps, email, WRONG_PASSWORD, ip);
    expect(sixth.status).toBe(429);
    // A-13 fix: the 429 message matches its RATE_LIMITED code (and its
    // window) instead of repeating the credential-failure copy.
    const sixthBody = await errorBody(sixth);
    expect(sixthBody.code).toBe("RATE_LIMITED");
    expect(sixthBody.message).toBe(LOGIN_BLOCKED_MESSAGE);

    // Expire the bucket directly — the window has lapsed, trying is allowed again.
    await db
      .update(rateLimits)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(rateLimits.key, loginRateLimitKey(ip, email)));

    const afterWindow = await signIn(authHttps, email, WRONG_PASSWORD, ip);
    expect(afterWindow.status).toBe(401);
  });

  it("clears the bucket on successful sign-in (4 fails → success → 1 fail is still allowed)", async () => {
    const email = "reset@example.com";
    const ip = "203.0.113.60";

    expect(
      (await signUpVerified(authHttps, email, TEST_PASSWORD, "203.0.113.61"))
        .status,
    ).toBe(200);

    for (let attempt = 1; attempt <= 4; attempt++) {
      expect((await signIn(authHttps, email, WRONG_PASSWORD, ip)).status).toBe(
        401,
      );
    }

    const success = await signIn(authHttps, email, TEST_PASSWORD, ip);
    expect(success.status).toBe(200);

    const oneMoreFailure = await signIn(authHttps, email, WRONG_PASSWORD, ip);
    expect(oneMoreFailure.status).toBe(401);

    const bucket = (
      await db
        .select({ count: rateLimits.count })
        .from(rateLimits)
        .where(eq(rateLimits.key, loginRateLimitKey(ip, email)))
        .limit(1)
    )[0];
    expect(bucket?.count).toBe(1);
  });

  it("reserves atomically: of 10 parallel sign-ins, only 5 reach the password check (AUTH-08)", async () => {
    const email = "paralel@example.com";
    const ip = "203.0.113.111";
    expect(
      (await signUp(authHttps, email, TEST_PASSWORD, "203.0.113.110")).status,
    ).toBe(200);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        signIn(authHttps, email, WRONG_PASSWORD, ip),
      ),
    );

    // The reservation upsert is atomic: the 10 concurrent requests get
    // distinct counts, so exactly five land on counts 1–5 (they reach the
    // password check and fail with 401) and five on 6–10 (429). A split
    // check-then-count would let all ten pass the check first.
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);

    // Per-status copy (A-13 fix): 401 keeps the §14.2 no-leak message,
    // 429 carries the rate-limit message that matches its code.
    for (const response of responses) {
      expect((await errorBody(response)).message).toBe(
        response.status === 429 ? LOGIN_BLOCKED_MESSAGE : LOGIN_FAILED_MESSAGE,
      );
    }

    // Blocked attempts keep their reservations until the window resets.
    const bucket = (
      await db
        .select({ count: rateLimits.count })
        .from(rateLimits)
        .where(eq(rateLimits.key, loginRateLimitKey(ip, email)))
        .limit(1)
    )[0];
    expect(bucket?.count).toBe(10);
  });

  it("rejects an invalid Turnstile token server-side without touching the bucket (AUTH-10)", async () => {
    const email = "captcha@example.com";
    const ip = "203.0.113.70";

    expect(
      (await signUp(authHttps, email, TEST_PASSWORD, "203.0.113.71")).status,
    ).toBe(200);

    const invalid = await signIn(
      authHttps,
      email,
      TEST_PASSWORD,
      ip,
      "bad-token",
    );
    expect(invalid.status).toBe(403);
    expect((await errorBody(invalid)).code).toBe("VERIFICATION_FAILED");

    const missing = await signIn(authHttps, email, TEST_PASSWORD, ip, "");
    expect(missing.status).toBe(400);
    expect((await errorBody(missing)).code).toBe("MISSING_RESPONSE");

    // Five captcha-invalid attempts are NOT failures in the login bucket:
    // the next credential attempt is still evaluated normally.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await signIn(
        authHttps,
        email,
        WRONG_PASSWORD,
        ip,
        "bad-token",
      );
      expect(response.status).toBe(403);
    }
    const credentialAttempt = await signIn(
      authHttps,
      email,
      WRONG_PASSWORD,
      ip,
    );
    expect(credentialAttempt.status).toBe(401);
  });

  it("requires Turnstile on /request-password-reset before the email bucket is touched (AUTH-10)", async () => {
    const email = "reset-captcha@example.com";

    // No x-captcha-response header at all → rejected, no email sent.
    const missing = await callAuth(
      authHttps,
      BASE_HTTPS,
      "/request-password-reset",
      { body: { email, redirectTo: "/reset-password" }, captcha: null },
    );
    expect(missing.status).toBe(400);
    expect((await errorBody(missing)).code).toBe("MISSING_RESPONSE");

    const invalid = await callAuth(
      authHttps,
      BASE_HTTPS,
      "/request-password-reset",
      { body: { email, redirectTo: "/reset-password" }, captcha: "bad-token" },
    );
    expect(invalid.status).toBe(403);
    expect((await errorBody(invalid)).code).toBe("VERIFICATION_FAILED");

    // Both rejections happen in captcha onRequest — BEFORE binzi-guard
    // reserves a 3/hour slot (the A-09 ordering guarantee).
    const rejectedBucket = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, passwordResetRateLimitKey(email)))
      .limit(1);
    expect(rejectedBucket).toHaveLength(0);

    // A valid token reaches the endpoint: generic 200 (§14.2 — unknown
    // address answers exactly like a registered one).
    const ok = await callAuth(
      authHttps,
      BASE_HTTPS,
      "/request-password-reset",
      { body: { email, redirectTo: "/reset-password" } },
    );
    expect(ok.status).toBe(200);
  });

  it("requires Turnstile on /send-verification-email before the email bucket is touched (AUTH-10)", async () => {
    const email = "resend-captcha@example.com";

    const missing = await callAuth(
      authHttps,
      BASE_HTTPS,
      "/send-verification-email",
      { body: { email, callbackURL: "/daftar/verifikasi" }, captcha: null },
    );
    expect(missing.status).toBe(400);
    expect((await errorBody(missing)).code).toBe("MISSING_RESPONSE");

    const invalid = await callAuth(
      authHttps,
      BASE_HTTPS,
      "/send-verification-email",
      { body: { email, callbackURL: "/daftar/verifikasi" }, captcha: "bad-token" },
    );
    expect(invalid.status).toBe(403);
    expect((await errorBody(invalid)).code).toBe("VERIFICATION_FAILED");

    const rejectedBucket = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, verificationEmailRateLimitKey(email)))
      .limit(1);
    expect(rejectedBucket).toHaveLength(0);

    const ok = await callAuth(
      authHttps,
      BASE_HTTPS,
      "/send-verification-email",
      { body: { email, callbackURL: "/daftar/verifikasi" } },
    );
    expect(ok.status).toBe(200);
  });

  it("blocks the 6th sign-up attempt; duplicates now answer 200 (generic, A-10)", async () => {
    const email = "dupe@example.com";
    const ip = "203.0.113.80";

    expect(
      (await signUp(authHttps, email, TEST_PASSWORD, "203.0.113.81")).status,
    ).toBe(200);

    // Since A-10 the duplicate-email response is shape-identical to a fresh
    // sign-up (200, no session) — but each attempt still reserves a slot.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await signUp(authHttps, email, TEST_PASSWORD, ip);
      expect(response.status).toBe(200);
      expect((await response.json()).token).toBeNull();
    }

    const sixth = await signUp(authHttps, email, TEST_PASSWORD, ip);
    expect(sixth.status).toBe(429);
    expect((await errorBody(sixth)).code).toBe("SIGNUP_RATE_LIMITED");
  });

  it("gives member sessions a fixed 30-day window and staff sessions 8 hours (AUTH-07)", async () => {
    const email = "durasi@example.com";
    await signUpVerified(authHttps, email, TEST_PASSWORD, "203.0.113.91");

    const memberResponse = await signIn(
      authHttps,
      email,
      TEST_PASSWORD,
      "203.0.113.92",
    );
    const memberJson = (await memberResponse.json()) as { token?: string };
    const memberSession = await latestSessionByToken(memberJson.token ?? "");
    expect(memberSession).toBeDefined();

    // Small skew tolerance: `createdAt` comes from app time inside Better
    // Auth, `expiresAt` from a `Date.now()` taken moments later (staff hook).
    const memberSpan =
      memberSession!.expiresAt.getTime() - memberSession!.createdAt.getTime();
    expect(memberSpan).toBeGreaterThan(30 * DAY_MS - 5 * 60 * 1000);
    expect(memberSpan).toBeLessThanOrEqual(30 * DAY_MS + 60_000);

    await db.update(users).set({ role: "ADMIN" }).where(eq(users.email, email));

    const staffResponse = await signIn(
      authHttps,
      email,
      TEST_PASSWORD,
      "203.0.113.93",
    );
    const staffJson = (await staffResponse.json()) as { token?: string };
    const staffSession = await latestSessionByToken(staffJson.token ?? "");
    expect(staffSession).toBeDefined();

    const staffSpan =
      staffSession!.expiresAt.getTime() - staffSession!.createdAt.getTime();
    expect(staffSpan).toBeGreaterThan(8 * HOUR_MS - 5 * 60 * 1000);
    expect(staffSpan).toBeLessThanOrEqual(8 * HOUR_MS + 60_000);
  });

  it("sets HttpOnly + SameSite=Lax cookies, with Secure only on https (§12.1)", async () => {
    const email = "cookie@example.com";
    await signUpVerified(authHttps, email, TEST_PASSWORD, "203.0.113.95");

    const httpsResponse = await signIn(
      authHttps,
      email,
      TEST_PASSWORD,
      "203.0.113.96",
    );
    expect(httpsResponse.status).toBe(200);
    // `useSecureCookies: true` makes Better Auth prefix the cookie with
    // `__Secure-` (browsers then reject it unless it is Secure AND sent over
    // https) — the name itself enforces the transport, on top of the attribute.
    const httpsCookie = httpsResponse.headers
      .getSetCookie()
      .find((cookie) =>
        cookie.startsWith("__Secure-better-auth.session_token="),
      );
    expect(httpsCookie).toBeDefined();
    expect(httpsCookie).toMatch(/HttpOnly/i);
    expect(httpsCookie).toMatch(/SameSite=Lax/i);
    expect(httpsCookie).toMatch(/Secure/);

    const emailHttp = "cookie-http@example.com";
    expect(
      (
        await callAuth(authHttp, BASE_HTTP, "/sign-up/email", {
          body: {
            name: "Rina Tester",
            email: emailHttp,
            password: TEST_PASSWORD,
          },
          ip: "203.0.113.97",
        })
      ).status,
    ).toBe(200);
    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.email, emailHttp));
    const httpResponse = await callAuth(authHttp, BASE_HTTP, "/sign-in/email", {
      body: { email: emailHttp, password: TEST_PASSWORD },
      ip: "203.0.113.98",
    });
    expect(httpResponse.status).toBe(200);
    const httpCookie = httpResponse.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("better-auth.session_token="));
    expect(httpCookie).toBeDefined();
    expect(httpCookie).toMatch(/HttpOnly/i);
    expect(httpCookie).toMatch(/SameSite=Lax/i);
    expect(httpCookie).not.toMatch(/Secure/);
  });
});
