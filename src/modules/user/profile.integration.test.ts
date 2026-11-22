// Integration tests for the /profil services over PGlite (card S5-05) —
// same harness pattern as src/modules/course/service.integration.test.ts:
// committed Drizzle migrations on a fresh in-memory database, direct row
// inserts, then the real service functions.
//
// Covers the card's "Selesai jika" for the user module:
// - updateMyName: trims + saves through the notDeleted-guarded query with
//   the phone untouched; 128 ok / 129 + blank → ZodError; strictObject
//   rejects smuggled keys (userId/phone/role/email/image) and no row
//   changes; two users stay independent; soft-deleted → NotFoundError.
// - getAccountSecurity: provider presence + password-ness (computed in
//   SQL) + live session count (expiresAt > now()), each scoped per user.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { accounts, sessions, users } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";

// queries.ts carries "server-only" and imports the singleton `db` from
// "@/db". "server-only" throws outside a React Server bundle — stub it.
// "@/db" eagerly parses the server env and opens a postgres-js pool at
// import time; the Proxy below forwards every property access to the
// PGlite instance installed in beforeAll (same pattern as the course
// service integration tests).
const dbHolder = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        const target = dbHolder.current as
          | Record<string | symbol, unknown>
          | undefined;
        if (!target) {
          throw new Error("@/db mock used before the PGlite instance was installed");
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    },
  ),
}));

import { getAccountSecurity, updateMyName } from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

const MEMBER_A = { id: "u-member-a", role: "MEMBER" as const };
const MEMBER_B = { id: "u-member-b", role: "MEMBER" as const };
const MEMBER_C = { id: "u-member-c", role: "MEMBER" as const };
const MEMBER_DELETED = { id: "u-member-del", role: "MEMBER" as const };

const HOUR_MS = 3_600_000;

// Plain row ids/tokens — the security query must never need the secret
// columns, and neither do these fixtures.
let seq = 0;
async function addAccount(
  userId: string,
  providerId: string,
  password: string | null,
) {
  seq += 1;
  await db.insert(accounts).values({
    id: `acc-${seq}`,
    userId,
    providerId,
    accountId: `${providerId}-${userId}`,
    ...(password === null ? {} : { password }),
  });
}

async function addSession(userId: string, expiresAt: Date) {
  seq += 1;
  await db.insert(sessions).values({
    id: `sess-${seq}`,
    userId,
    token: `tok-${seq}`,
    expiresAt,
  });
}

async function userName(userId: string): Promise<string> {
  const rows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.name ?? "";
}

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/migrations", import.meta.url),
    ),
  });
  db = pgliteDb as unknown as Db;
  dbHolder.current = pgliteDb;

  await db.insert(users).values([
    // A: credential WITH password + google, phone set (a rename must not
    //    touch it), 2 live sessions + 1 already expired.
    {
      id: MEMBER_A.id,
      name: "Sinta Contoh",
      email: "sinta-a@example.com",
      emailVerified: true,
      role: "MEMBER",
      phone: "+62812345678",
    },
    // B: google only — no password anywhere, 3 live sessions.
    {
      id: MEMBER_B.id,
      name: "Budi Google",
      email: "budi-b@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
    // C: credential row with a NULL password — hasPassword must stay false.
    {
      id: MEMBER_C.id,
      name: "Cici Null",
      email: "cici-c@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
    // Soft-deleted: every write must behave as "user not found" (404).
    {
      id: MEMBER_DELETED.id,
      name: "Dihapus Soft",
      email: "deleted-d@example.com",
      emailVerified: true,
      role: "MEMBER",
      deletedAt: new Date(),
    },
  ]);

  await addAccount(MEMBER_A.id, "credential", "not-a-real-hash");
  await addAccount(MEMBER_A.id, "google", null);
  await addAccount(MEMBER_B.id, "google", null);
  await addAccount(MEMBER_C.id, "credential", null);

  await addSession(MEMBER_A.id, new Date(Date.now() + HOUR_MS));
  await addSession(MEMBER_A.id, new Date(Date.now() + HOUR_MS));
  await addSession(MEMBER_A.id, new Date(Date.now() - HOUR_MS)); // expired
  await addSession(MEMBER_B.id, new Date(Date.now() + HOUR_MS));
  await addSession(MEMBER_B.id, new Date(Date.now() + HOUR_MS));
  await addSession(MEMBER_B.id, new Date(Date.now() + HOUR_MS));
  await addSession(MEMBER_C.id, new Date(Date.now() + HOUR_MS));
});

afterAll(async () => {
  await pglite.close();
});

describe("updateMyName (card S5-05)", () => {
  it("trims and saves the name without touching the phone", async () => {
    const dto = await updateMyName(MEMBER_A, { name: "  Sinta Baru  " });
    expect(dto.name).toBe("Sinta Baru");

    const row = await db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, MEMBER_A.id))
      .limit(1);
    expect(row[0]).toEqual({ name: "Sinta Baru", phone: "+62812345678" });
  });

  it("accepts 128 characters, rejects 129, blank, and whitespace-only", async () => {
    const longest = "a".repeat(128);
    const dto = await updateMyName(MEMBER_A, { name: longest });
    expect(dto.name).toBe(longest);

    for (const bad of ["a".repeat(129), "", "   "]) {
      await expect(
        updateMyName(MEMBER_A, { name: bad }),
      ).rejects.toBeInstanceOf(ZodError);
    }
  });

  it("rejects smuggled keys (userId, phone, role, email, image) and changes no row", async () => {
    // updateNameInput is strictObject: the only field a client may send is
    // name — the route always writes to the session user's id.
    await db
      .update(users)
      .set({ name: "Nama Awal" })
      .where(eq(users.id, MEMBER_A.id));

    for (const extra of [
      { userId: MEMBER_B.id },
      { phone: "+628999999999" },
      { role: "ADMIN" },
      { email: "hacker@example.test" },
      { image: "https://evil.test/x.png" },
    ]) {
      await expect(
        updateMyName(MEMBER_A, { name: "Nama Baru", ...extra }),
      ).rejects.toBeInstanceOf(ZodError);
    }

    expect(await userName(MEMBER_A.id)).toBe("Nama Awal");
    expect(await userName(MEMBER_B.id)).toBe("Budi Google");
  });

  it("keeps two users independent: A renames, B stays", async () => {
    await updateMyName(MEMBER_A, { name: "Hanya A" });
    expect(await userName(MEMBER_A.id)).toBe("Hanya A");
    expect(await userName(MEMBER_B.id)).toBe("Budi Google");
  });

  it("soft-deleted user → NotFoundError", async () => {
    await expect(
      updateMyName(MEMBER_DELETED, { name: "Zombi" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await userName(MEMBER_DELETED.id)).toBe("Dihapus Soft");
  });
});

describe("getAccountSecurity (card S5-05)", () => {
  it("summarizes providers and live sessions per user", async () => {
    // A: credential password + google, 2 live of 3 sessions.
    await expect(getAccountSecurity(MEMBER_A)).resolves.toEqual({
      hasPassword: true,
      googleLinked: true,
      activeSessionCount: 2,
    });
    // B: google only, 3 live sessions.
    await expect(getAccountSecurity(MEMBER_B)).resolves.toEqual({
      hasPassword: false,
      googleLinked: true,
      activeSessionCount: 3,
    });
    // C: credential row with NULL password is not a password (no google).
    await expect(getAccountSecurity(MEMBER_C)).resolves.toEqual({
      hasPassword: false,
      googleLinked: false,
      activeSessionCount: 1,
    });
  });
});
