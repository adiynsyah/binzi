// Integration tests for email verification & password reset (card A-10
// "Selesai jika"). Same harness as A-09: in-process Postgres (PGlite) with
// the committed migrations, the real auth instance driven through
// auth.handler(Request), a loopback Turnstile mock, and — instead of a
// network transport — an in-memory capture behind the real template
// pipeline (createMailCallbacks → src/emails/**).
//
// Covers: verification email on sign-up (no session until verified),
// shape-identical duplicate sign-up (enumeration), EMAIL_NOT_VERIFIED on
// sign-in, magic-link verification (welcome email + auto sign-in with a
// member-length session), TOKEN_EXPIRED / INVALID_TOKEN as the stable
// error codes for A-13, identical reset responses for registered and
// unknown emails, single-use + 1-hour reset tokens, session revocation on
// reset, the 3-per-hour-per-email buckets (§12.4), and mail failures that
// never surface to the HTTP responses.
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "../../db/schema";
import { sessions, users, verifications } from "../../db/schema";
import type { Db } from "../../db/client";
import type { MailMessage } from "../../lib/mail";
import { createAuthInstance, type AuthInstance } from "./better-auth";
import { createMailCallbacks } from "./email-senders";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const BASE = "https://binzi-test.example.com";
const VALID_CAPTCHA = "valid-captcha-token";
const TEST_PASSWORD = "Gizi1234";
const NEW_PASSWORD = "Baru12345";
const CHROME_WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36";

const DAY_MS = 24 * 60 * 60 * 1000;

// Loopback mock of challenges.cloudflare.com/turnstile/v0/siteverify.
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
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ success: token === VALID_CAPTCHA }));
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
let auth: AuthInstance;

// In-memory transport with a switchable failure mode (point d).
const sent: MailMessage[] = [];
let mailFailure: Error | null = null;
const sendMail = async (message: MailMessage): Promise<void> => {
  if (mailFailure) throw mailFailure;
  sent.push(message);
};

const mailLog = vi.spyOn(console, "error").mockImplementation(() => {});

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/migrations", import.meta.url),
    ),
  });
  db = pgliteDb as unknown as Db;

  auth = createAuthInstance({
    db,
    secret: "integration-test-secret-0123456789abcdef",
    baseURL: BASE,
    trustedOrigins: [BASE],
    captcha: { secretKey: "test-key", siteVerifyURLOverride: siteVerify.url },
    mail: createMailCallbacks(sendMail, { appUrl: BASE }),
  });
});

afterAll(async () => {
  mailLog.mockRestore();
  await pglite.close();
  siteVerify.server.close();
});

type CallOptions = {
  body?: unknown;
  method?: string;
  ip?: string;
  userAgent?: string;
};

function callAuth(path: string, options: CallOptions = {}): Promise<Response> {
  const { body, method = "POST", ip, userAgent } = options;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin: BASE,
    "x-captcha-response": VALID_CAPTCHA,
    ...(ip ? { "x-forwarded-for": ip } : {}),
    ...(userAgent ? { "user-agent": userAgent } : {}),
  };
  return auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method,
      headers,
      ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
    }),
  );
}

const signUp = (email: string, ip: string) =>
  callAuth("/sign-up/email", {
    body: { name: "Rina Tester", email, password: TEST_PASSWORD },
    ip,
  });

const signIn = (email: string, password: string, ip: string) =>
  callAuth("/sign-in/email", { body: { email, password }, ip });

const requestReset = (email: string, userAgent?: string) =>
  callAuth("/request-password-reset", { body: { email }, userAgent });

const sendVerification = (email: string) =>
  callAuth("/send-verification-email", { body: { email } });

async function errorBody(
  response: Response,
): Promise<{ code?: string; message?: string }> {
  return (await response.json()) as { code?: string; message?: string };
}

function mailBySubject(part: string): MailMessage {
  const found = sent.filter((message) => message.subject.includes(part));
  expect(found.length, `expected at least one "${part}" mail`).toBeGreaterThan(
    0,
  );
  return found[found.length - 1]!;
}

/** Marks a user as verified straight in the DB (flow helper). */
async function verifyInDb(email: string): Promise<string> {
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.email, email));
  const row = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
  )[0];
  expect(row).toBeDefined();
  return row!.id;
}

/** Forges an already-expired verification JWT (HS256, Better Auth's shape). */
function expiredVerificationToken(email: string): string {
  const secret = "integration-test-secret-0123456789abcdef";
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ email, iat: now - 7200, exp: now - 3600 });
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Extracts the reset token from the emailed link's path. */
function resetTokenFrom(mail: MailMessage): string {
  const token = new URL(mail.link ?? "").pathname.split("/").pop();
  expect(token).toBeTruthy();
  return token!;
}

describe("A-10 verification flow (PGlite)", () => {
  it("signs a user up WITHOUT a session and sends the verification email (AUTH-03)", async () => {
    const email = "verif1@example.com";
    const response = await signUp(email, "198.51.100.1");

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      token: string | null;
      user: { emailVerified: boolean };
    };
    expect(json.token).toBeNull();
    expect(json.user.emailVerified).toBe(false);

    const row = (
      await db
        .select({ verified: users.emailVerified, role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    )[0];
    expect(row?.verified).toBe(false);
    expect(row?.role).toBe("MEMBER");

    const sessionRows = await db
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(users.email, email));
    expect(sessionRows).toHaveLength(0);

    const mail = mailBySubject("Verifikasi email Anda");
    expect(mail.to).toBe(email);
    expect(mail.link).toContain(`${BASE}/api/auth/verify-email?token=`);
    expect(mail.html).toContain("Tautan berlaku 24 jam");
  });

  it("answers a duplicate sign-up with the same response shape (enumeration)", async () => {
    const email = "dupe-shape@example.com";
    const fresh = await signUp(email, "198.51.100.2");
    expect(fresh.status).toBe(200);
    const freshJson = (await fresh.json()) as {
      token: string | null;
      user: Record<string, unknown>;
    };

    const sentBefore = sent.length;
    const duplicate = await signUp(email, "198.51.100.3");
    expect(duplicate.status).toBe(200);
    const duplicateJson = (await duplicate.json()) as {
      token: string | null;
      user: Record<string, unknown>;
    };

    // Same envelope: no session, identical key set, DB-default role/status.
    expect(duplicateJson.token).toBeNull();
    expect(Object.keys(duplicateJson.user).sort()).toEqual(
      Object.keys(freshJson.user).sort(),
    );
    expect(duplicateJson.user.role).toBe("MEMBER");
    expect(duplicateJson.user.status).toBe("ACTIVE");
    expect(duplicateJson.user.emailVerified).toBe(false);
    expect(duplicateJson.user.name).toBe(freshJson.user.name);

    // No second email for the existing address.
    expect(sent.length).toBe(sentBefore);
  });

  it("rejects sign-in before verification (wrong password stays generic)", async () => {
    const email = "unverified@example.com";
    await signUp(email, "198.51.100.4");

    const wrongPassword = await signIn(email, "Salah123", "198.51.100.5");
    expect(wrongPassword.status).toBe(401);
    expect((await errorBody(wrongPassword)).code).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );

    const correctPassword = await signIn(email, TEST_PASSWORD, "198.51.100.6");
    expect(correctPassword.status).toBe(403);
    expect((await errorBody(correctPassword)).code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("completes the magic link: verifies, sends the welcome email, signs in (AUTH-03)", async () => {
    const email = "magic@example.com";
    await signUp(email, "198.51.100.7");

    const link = mailBySubject("Verifikasi email Anda").link!;
    const response = await auth.handler(
      new Request(link, { headers: { origin: BASE } }),
    );
    // Better Auth redirects to the callbackURL ("/" by default).
    expect([200, 302]).toContain(response.status);

    const row = (
      await db
        .select({ verified: users.emailVerified, id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    )[0];
    expect(row?.verified).toBe(true);

    const welcome = mailBySubject("Selamat datang di BINZI");
    expect(welcome.to).toBe(email);
    expect(welcome.html).toContain("Tiga hal yang perlu diketahui");

    // autoSignInAfterVerification: a session exists, member-length window.
    const session = (
      await db
        .select({
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(eq(sessions.userId, row!.id))
        .limit(1)
    )[0];
    expect(session).toBeDefined();
    const span = session!.expiresAt.getTime() - session!.createdAt.getTime();
    expect(span).toBeGreaterThan(30 * DAY_MS - 5 * 60 * 1000);
    expect(span).toBeLessThanOrEqual(30 * DAY_MS + 60_000);

    // And afterwards a normal sign-in works.
    expect((await signIn(email, TEST_PASSWORD, "198.51.100.8")).status).toBe(
      200,
    );
  });

  it("rejects an expired verification link with the stable code TOKEN_EXPIRED", async () => {
    const token = expiredVerificationToken("expired@example.com");
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/verify-email?token=${token}`, {
        headers: { origin: BASE },
      }),
    );
    expect(response.status).toBe(401);
    expect((await errorBody(response)).code).toBe("TOKEN_EXPIRED");
  });

  it("rejects a garbage verification token with the stable code INVALID_TOKEN", async () => {
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/verify-email?token=bukan-token`, {
        headers: { origin: BASE },
      }),
    );
    expect(response.status).toBe(401);
    expect((await errorBody(response)).code).toBe("INVALID_TOKEN");
  });
});

describe("A-10 password reset flow (PGlite)", () => {
  it("answers registered and unknown emails identically (AUTH-04, §14.2)", async () => {
    const email = "reset1@example.com";
    await signUp(email, "203.0.113.1");
    await verifyInDb(email);

    const sentBefore = sent.length;
    const known = await requestReset(email, CHROME_WINDOWS_UA);
    const unknown = await requestReset("tidak-ada@example.com");

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());

    // Exactly one mail went out — for the registered address, with the
    // device metadata parsed from the request's User-Agent.
    expect(sent.length).toBe(sentBefore + 1);
    const mail = mailBySubject("Atur ulang password");
    expect(mail.to).toBe(email);
    expect(mail.link).toContain(`${BASE}/api/auth/reset-password/`);
    expect(mail.html).toContain("Permintaan dibuat dari Chrome di Windows");
  });

  it("resets the password once, revoking every session (AUTH-04)", async () => {
    const email = "reset2@example.com";
    await signUp(email, "203.0.113.2");
    const userId = await verifyInDb(email);

    expect((await signIn(email, TEST_PASSWORD, "203.0.113.3")).status).toBe(
      200,
    );
    expect(
      (
        await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.userId, userId))
      ).length,
    ).toBeGreaterThan(0);

    expect((await requestReset(email)).status).toBe(200);
    const token = resetTokenFrom(mailBySubject("Atur ulang password"));

    const reset = await callAuth("/reset-password", {
      body: { token, newPassword: NEW_PASSWORD },
    });
    expect(reset.status).toBe(200);

    // Every session of this user is gone.
    expect(
      await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId)),
    ).toHaveLength(0);

    // Old password no longer works; the new one does.
    expect((await signIn(email, TEST_PASSWORD, "203.0.113.4")).status).toBe(
      401,
    );
    expect((await signIn(email, NEW_PASSWORD, "203.0.113.5")).status).toBe(200);

    // The token cannot be used a second time.
    const reuse = await callAuth("/reset-password", {
      body: { token, newPassword: "Lagi12345" },
    });
    expect(reuse.status).toBe(400);
    expect((await errorBody(reuse)).code).toBe("INVALID_TOKEN");
  });

  it("rejects an expired reset token (1 hour, AUTH-04)", async () => {
    const email = "reset3@example.com";
    await signUp(email, "203.0.113.6");
    await verifyInDb(email);

    expect((await requestReset(email)).status).toBe(200);
    const token = resetTokenFrom(mailBySubject("Atur ulang password"));

    await db
      .update(verifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(verifications.identifier, `reset-password:${token}`)));

    const response = await callAuth("/reset-password", {
      body: { token, newPassword: NEW_PASSWORD },
    });
    expect(response.status).toBe(400);
    expect((await errorBody(response)).code).toBe("INVALID_TOKEN");
  });

  it("limits reset requests to 3 per hour per email (§12.4)", async () => {
    const email = "ratelimit-reset@example.com";
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await requestReset(email)).status).toBe(200);
    }

    const fourth = await requestReset(email);
    expect(fourth.status).toBe(429);
    const body = await errorBody(fourth);
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.message).toBe(
      "Terlalu banyak permintaan. Coba lagi dalam satu jam.",
    );

    // A different email has its own bucket.
    expect((await requestReset("email-lain@example.com")).status).toBe(200);
  });
});

describe("A-10 verification resend + rate limit (§12.4)", () => {
  it("answers resend identically for known and unknown emails, then limits at 3/hour", async () => {
    const known = "resend@example.com";
    await signUp(known, "203.0.114.1");

    const firstKnown = await sendVerification(known);
    const firstUnknown = await sendVerification("tidak-terdaftar@example.com");
    expect(firstKnown.status).toBe(200);
    expect(await firstKnown.json()).toEqual(await firstUnknown.json());

    // Two more for the known address, then the 4th hits the bucket.
    expect((await sendVerification(known)).status).toBe(200);
    expect((await sendVerification(known)).status).toBe(200);
    const fourth = await sendVerification(known);
    expect(fourth.status).toBe(429);
    expect((await errorBody(fourth)).code).toBe("RATE_LIMITED");
  });
});

describe("A-10 mail failures never surface to the HTTP flow (point d)", () => {
  it("keeps sign-up, reset, and verification responses generic when sending fails", async () => {
    mailLog.mockClear();

    // A user whose verification link exists BEFORE the outage — the
    // welcome email will fail inside the unwrapped afterEmailVerification
    // hook, yet the verification request itself must still succeed.
    const toVerify = "outage-verify@example.com";
    await signUp(toVerify, "203.0.115.1");
    const link = mailBySubject("Verifikasi email Anda").link!;

    // A verified user for the reset leg.
    const toReset = "outage-reset@example.com";
    await signUp(toReset, "203.0.115.2");
    await verifyInDb(toReset);

    mailFailure = new Error("simulated transport outage");
    try {
      // Sign-up: verification email is lost, response stays 200 + generic.
      const signUpResponse = await signUp(
        "outage-signup@example.com",
        "203.0.115.3",
      );
      expect(signUpResponse.status).toBe(200);

      // Forgot-password: reset email is lost, response stays 200 + generic.
      expect((await requestReset(toReset)).status).toBe(200);

      // Magic link: welcome email is lost, verification still completes.
      const verified = await auth.handler(
        new Request(link, { headers: { origin: BASE } }),
      );
      expect([200, 302]).toContain(verified.status);
      const row = (
        await db
          .select({ verified: users.emailVerified })
          .from(users)
          .where(eq(users.email, toVerify))
          .limit(1)
      )[0];
      expect(row?.verified).toBe(true);

      // Failures are logged — with masked addresses only.
      expect(mailLog).toHaveBeenCalled();
      const logged = mailLog.mock.calls.flat().map(String).join("\n");
      expect(logged).not.toContain("outage-verify@example.com");
      expect(logged).not.toContain("outage-reset@example.com");
      expect(logged).toMatch(/o\*\*\*@example\.com/);
    } finally {
      mailFailure = null;
    }
  });
});
