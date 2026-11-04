// Integration tests for quiz-module settings over PGlite (card S1-02):
// getMinQuestions is fail-closed — a missing quiz.min_questions row, a
// string "10", or 0 must all reject with an Error naming the key and the
// seed command (never a silent fallback number).
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { systemSettings } from "@/db/schema";

// Same harness pattern as src/modules/course/service.integration.test.ts:
// "server-only" stubbed, the "@/db" singleton proxied onto the PGlite
// instance installed in beforeAll.
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

import { getMinQuestions } from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("../../db/migrations", import.meta.url)),
  });
  db = pgliteDb as unknown as Db;
  dbHolder.current = pgliteDb;
});

afterAll(async () => {
  await pglite.close();
});

/**
 * Writes the setting as EXACTLY the JSON value intended: a JS string like
 * "10" passed as a plain drizzle jsonb param arrives as the text '10' and
 * Postgres casts it to the JSON NUMBER 10 — the very invalid shape the
 * test wants to plant would silently turn valid. Stringify + ::jsonb pins
 * the JSONB type.
 */
async function setSetting(value: unknown): Promise<void> {
  await pglite.query(
    `insert into system_settings (key, value)
     values ('quiz.min_questions', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(value)],
  );
}

describe("getMinQuestions — fail-closed", () => {
  it("a valid integer ≥ 1 resolves", async () => {
    await setSetting(10);
    await expect(getMinQuestions()).resolves.toBe(10);
    await setSetting(1);
    await expect(getMinQuestions()).resolves.toBe(1);
  });

  it("missing row → Error naming the key and npm run db:seed", async () => {
    await db
      .delete(systemSettings)
      .where(eq(systemSettings.key, "quiz.min_questions"));
    const error = await getMinQuestions().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("quiz.min_questions");
    expect(message).toContain("npm run db:seed");
  });

  it("string \"10\" → Error", async () => {
    await setSetting("10");
    await expect(getMinQuestions()).rejects.toBeInstanceOf(Error);
  });

  it("0 → Error", async () => {
    await setSetting(0);
    await expect(getMinQuestions()).rejects.toBeInstanceOf(Error);
  });

  it("non-integer numbers → Error", async () => {
    await setSetting(9.5);
    await expect(getMinQuestions()).rejects.toBeInstanceOf(Error);
  });
});
