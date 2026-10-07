// Integration tests for the A-12 RBAC guards and set-role over a real
// Better Auth instance (PGlite, committed Drizzle migrations — same
// harness pattern as src/modules/auth/better-auth.integration.test.ts).
//
// Covers the card's "Selesai jika" + owner decisions #4/#6/#9:
// - /api/cms guard semantics: 401 (no session), 403 (role too low), 200
//   path (EDITOR+) — JSON errors, never redirects.
// - Role & status are read from the DB PER REQUEST: a role promoted in
//   the DB takes effect on the very next call with the SAME cookie.
// - SUSPENDED users are treated exactly like signed-out (fail closed).
// - set-role (setUserRole): email normalization, one-transaction role
//   change + session revocation, revoked-session count, NO audit_logs row.
//
// requireApiUser/requireApiRole are driven with a SessionReader bound to
// the test instance (their default reader resolves env + DB through
// src/lib/auth.ts, which does not exist under vitest). The page guards
// (requireUser/requireRole) need a Next request scope and are exercised
// end-to-end by the manual V-04 verification instead.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { setUserRole } from "../../scripts/set-role";
import * as schema from "../db/schema";
import { auditLogs, sessions, users } from "../db/schema";
import type { Db } from "../db/client";
import {
  createAuthInstance,
  type AuthInstance,
} from "../modules/auth/better-auth";
import { createMailCallbacks } from "../modules/auth/email-senders";
import {
  requireApiRole,
  requireApiUser,
  toSessionUser,
  type SessionReader,
} from "./rbac";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const BASE = "https://binzi-rbac-test.example.com";
const PASSWORD = "Gizi1234";

let pglite: PGlite;
let db: Db;
let auth: AuthInstance;
let ipCounter = 0;

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("../db/migrations", import.meta.url)),
  });
  db = pgliteDb as unknown as Db;

  auth = createAuthInstance({
    db,
    secret: "rbac-integration-test-secret-0123456789",
    baseURL: BASE, // https → __Secure- cookie prefix
    trustedOrigins: [BASE],
    captcha: null, // Turnstile disabled for tests
    mail: createMailCallbacks(async () => {}, { appUrl: BASE }),
  });
});

afterAll(async () => {
  await pglite.close();
});

/** Sign-up + straight-DB verification flip (stands in for the A-10 link). */
async function signUpVerified(email: string): Promise<void> {
  const response = await auth.handler(
    new Request(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({
        name: "RBAC Tester",
        email,
        password: PASSWORD,
      }),
    }),
  );
  expect(response.status).toBe(200);
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.email, email));
}

/** Signs in and returns the session cookie pair ("name=value"). */
async function signInCookie(email: string): Promise<string> {
  ipCounter += 1; // distinct IP per sign-in: never near the login bucket
  const response = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE,
        "x-forwarded-for": `198.51.100.${ipCounter % 250}`,
      },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.includes("better-auth.session_token"));
  if (!cookie) throw new Error("sign-in did not set a session cookie");
  return cookie.split(";")[0]!;
}

const readSession: SessionReader = async (headers) =>
  toSessionUser(
    await auth.api.getSession({
      headers,
      query: { disableCookieCache: true },
    }),
  );

function apiRequest(cookie?: string): Request {
  return new Request(`${BASE}/api/cms/ping`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("API guards over a real session (PGlite)", () => {
  it("401 without a session — UnauthorizedError, never a redirect", async () => {
    const request = apiRequest();
    await expect(requireApiUser(request, readSession)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    // 401 BEFORE 403: an unidentified caller is not told the role needed.
    await expect(
      requireApiRole("EDITOR", request, readSession),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("403 for MEMBER on an EDITOR endpoint (V-04 semantics)", async () => {
    const email = "member-rbac@example.com";
    await signUpVerified(email);
    const cookie = await signInCookie(email);

    const user = await requireApiUser(apiRequest(cookie), readSession);
    expect(user).toMatchObject({ role: "MEMBER", status: "ACTIVE" });

    await expect(
      requireApiRole("EDITOR", apiRequest(cookie), readSession),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("reads the role from the DB on every request — promotion applies to the SAME cookie", async () => {
    const email = "promoted-rbac@example.com";
    await signUpVerified(email);
    const cookie = await signInCookie(email);

    await expect(
      requireApiRole("EDITOR", apiRequest(cookie), readSession),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    await db.update(users).set({ role: "EDITOR" }).where(eq(users.email, email));

    const editor = await requireApiRole(
      "EDITOR",
      apiRequest(cookie),
      readSession,
    );
    expect(editor.role).toBe("EDITOR");
  });

  it("treats SUSPENDED as signed out (fail closed)", async () => {
    const email = "suspended-rbac@example.com";
    await signUpVerified(email);
    const cookie = await signInCookie(email);

    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.email, email));

    await expect(
      requireApiUser(apiRequest(cookie), readSession),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });
});

describe("setUserRole (scripts/set-role.ts core)", () => {
  it("changes the role and revokes every session in one transaction", async () => {
    const email = "setrole-rbac@example.com";
    await signUpVerified(email);
    await signInCookie(email); // device 1
    await signInCookie(email); // device 2
    const oldCookie = await signInCookie(email); // device 3 (also revoked)

    // Normalization: trim + lowercase before lookup.
    const result = await setUserRole(
      db,
      `  ${email.toUpperCase()} `,
      "SUPER_ADMIN",
    );
    expect(result).toMatchObject({
      email,
      oldRole: "MEMBER",
      newRole: "SUPER_ADMIN",
      revokedSessions: 3,
    });

    const remaining = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, result.userId));
    expect(remaining).toEqual([]);

    // The revoked session is treated as signed out on the next request.
    await expect(
      requireApiUser(apiRequest(oldCookie), readSession),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });

    // CLI writes no audit row (actor_id NOT NULL, no CLI actor).
    const auditRows = await db.select({ id: auditLogs.id }).from(auditLogs);
    expect(auditRows).toEqual([]);
  });

  it("rejects an unknown role and an unknown email", async () => {
    await signUpVerified("validation-rbac@example.com");

    await expect(
      setUserRole(db, "validation-rbac@example.com", "GUEST"),
    ).rejects.toThrow(/Role tidak valid/);
    await expect(
      setUserRole(db, "nobody@example.com", "ADMIN"),
    ).rejects.toThrow(/tidak ditemukan/);
  });
});
