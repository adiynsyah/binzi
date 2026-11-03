// Integration tests for the course service over PGlite (card S1-01) — same
// harness pattern as src/lib/rbac.integration.test.ts: committed Drizzle
// migrations on a fresh in-memory database, direct user inserts, then the
// real service functions.
//
// Covers the card's "Selesai jika":
// - createCourse = one transaction: course row + empty FINAL quiz + ONE
//   audit row (after = the serialized DTO, ip null).
// - Duplicate slug, forbidden slug, similar title → ZodError with the right
//   field path (slug, slug, title) — the 400 + fields response shape.
// - Two concurrent createCourse with the same slug → one succeeds, one gets
//   the slug field error (never a 500).
// - The deterministic 23505 path: calling the queries-level transaction
//   directly with an existing slug (pre-check bypassed).
// - MEMBER → ForbiddenError BEFORE input parsing.
// - DTO allowlist: no column outside the explicit list ever leaves.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { auditLogs, courses, quizzes, users } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

// queries.ts carries "server-only" and imports the singleton `db` from
// "@/db". "server-only" throws outside a React Server bundle — stub it (same
// pattern as src/config/env.server.test.ts). "@/db" eagerly parses the server
// env and opens a postgres-js pool at import time; neither is wanted here.
// The factory's `db` is a Proxy that forwards every property access to the
// PGlite instance installed in beforeAll, so imports stay static while the
// swap happens later (vi.hoisted keeps the holder alive across the hoisted
// factory).
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

import * as courseQueries from "./queries";
import { createCourse, getCourseDetail, listCourses } from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

const EDITOR = { id: "u-editor", role: "EDITOR" as const };
const MEMBER = { id: "u-member", role: "MEMBER" as const };

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("../../db/migrations", import.meta.url)),
  });
  db = pgliteDb as unknown as Db;
  dbHolder.current = pgliteDb;

  await db.insert(users).values([
    {
      id: EDITOR.id,
      name: "  ",
      email: "editor@example.com",
      emailVerified: true,
      role: "EDITOR",
    },
    {
      id: MEMBER.id,
      name: "Member Biasa",
      email: "member@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
  ]);
});

afterAll(async () => {
  await pglite.close();
});

/** Unique title+slug pair per call (prefix rule can never cross-match). */
let counter = 0;
function nextPair(prefix: string): { title: string; slug: string } {
  counter += 1;
  return {
    title: `${prefix} kursu ${counter}`,
    slug: `${prefix}-kursu-${counter}`,
  };
}

function inputFor(
  prefix: string,
  overrides: Partial<{ title: string; slug: string; summary: string }> = {},
) {
  const { title, slug } = nextPair(prefix);
  return {
    title,
    slug,
    level: "BEGINNER" as const,
    summary: "Ringkasan netral untuk tes.",
    ...overrides,
  };
}

describe("createCourse — one transaction", () => {
  it("writes course + empty FINAL quiz + one audit row, linked", async () => {
    const input = inputFor("tx");
    const dto = await createCourse(EDITOR, input);

    // Course row: DRAFT, final quiz linked, actor as creator/updater.
    const [courseRow] = await db.select().from(courses).where(eq(courses.id, dto.id));
    if (!courseRow) throw new Error("course row missing");
    expect(courseRow.status).toBe("DRAFT");
    expect(courseRow.createdBy).toBe(EDITOR.id);
    expect(courseRow.updatedBy).toBe(EDITOR.id);
    expect(courseRow.finalQuizId).toBe(dto.finalQuiz?.id);

    // Quiz row: FINAL with the card's defaults (21g "Sudah disiapkan kosong").
    const finalQuizId = courseRow.finalQuizId;
    if (!finalQuizId) throw new Error("finalQuizId missing");
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, finalQuizId));
    if (!quiz) throw new Error("quiz row missing");
    expect(quiz.type).toBe("FINAL");
    expect(quiz.title).toBe("Final Quiz");
    expect(quiz.durationMinutes).toBe(20);
    expect(quiz.passingScorePercent).toBe(70);
    expect(quiz.maxAttempts).toBe(1);
    expect(quiz.explanationPolicy).toBe("ALWAYS");

    // Exactly ONE audit row, after = the serialized DTO, ip null.
    const auditRows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "course"), eq(auditLogs.entityId, dto.id)));
    expect(auditRows).toHaveLength(1);
    const audit = auditRows[0];
    if (!audit) throw new Error("audit row missing");
    expect(audit.actorId).toBe(EDITOR.id);
    expect(audit.action).toBe("course.create");
    expect(audit.before).toBeNull();
    expect(audit.ip).toBeNull();
    expect(audit.after).toEqual(dto);
  });

  it("returns a DTO with exactly the allowlisted keys", async () => {
    const dto = await createCourse(EDITOR, inputFor("keys"));
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "title",
        "slug",
        "summary",
        "description",
        "thumbnailUrl",
        "level",
        "status",
        "estimatedMinutes",
        "publishedAt",
        "enrollmentCount",
        "ownerName",
        "updatedAt",
        "finalQuiz",
      ].sort(),
    );
    // Blank name falls back to the email.
    expect(dto.ownerName).toBe("editor@example.com");
  });
});

describe("createCourse — field errors (400 + fields shape)", () => {
  it("duplicate slug → ZodError path slug", async () => {
    const first = await createCourse(EDITOR, inputFor("dup"));
    const result = createCourse(EDITOR, inputFor("dup", { slug: first.slug }));
    await expect(result).rejects.toBeInstanceOf(ZodError);
    await expect(result).rejects.toMatchObject({
      issues: [{ path: ["slug"] }],
    });
  });

  it("forbidden slug → ZodError path slug (schema rule)", async () => {
    const result = createCourse(EDITOR, inputFor("forb", { slug: "nilai" }));
    await expect(result).rejects.toBeInstanceOf(ZodError);
    await expect(result).rejects.toMatchObject({
      issues: [{ path: ["slug"], message: expect.stringContaining("nilai") }],
    });
  });

  it("similar title → ZodError path title with the 21f copy", async () => {
    const first = await createCourse(EDITOR, inputFor("sim"));
    // Existing title is a prefix of the new one (and vice versa case below).
    const longer = createCourse(EDITOR, inputFor("sim", { title: `${first.title} lanjutan` }));
    await expect(longer).rejects.toBeInstanceOf(ZodError);
    await expect(longer).rejects.toMatchObject({
      issues: [{ path: ["title"], message: expect.stringContaining(first.title) }],
    });

    const shorter = createCourse(EDITOR, inputFor("sim", { title: first.title.slice(0, 8) }));
    await expect(shorter).rejects.toBeInstanceOf(ZodError);
  });

  it("compares against ARCHIVED courses too", async () => {
    const first = await createCourse(EDITOR, inputFor("arc"));
    await db
      .update(courses)
      .set({ status: "ARCHIVED" })
      .where(eq(courses.id, first.id));

    const result = createCourse(EDITOR, inputFor("arc", { title: `${first.title} dua` }));
    await expect(result).rejects.toMatchObject({
      issues: [{ path: ["title"] }],
    });
  });

  it("two concurrent creates with the same slug → one ok, one 400 slug (no 500)", async () => {
    const base = inputFor("cc");
    const a = { ...base, title: `${base.title} a` };
    const b = { ...base, title: `${base.title} b` };
    const results = await Promise.allSettled([
      createCourse(EDITOR, a),
      createCourse(EDITOR, b),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ZodError);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      issues: [{ path: ["slug"] }],
    });
  });

  it("unique violation at insert (pre-check bypassed) → ZodError path slug", async () => {
    // Deterministic 23505: the queries-level transaction itself, with a slug
    // that already exists. This is the path a concurrent request takes.
    const first = await createCourse(EDITOR, inputFor("uq"));
    const result = courseQueries.createCourseWithFinalQuiz(
      { ...inputFor("uq"), slug: first.slug },
      EDITOR.id,
    );
    await expect(result).rejects.toBeInstanceOf(ZodError);
    await expect(result).rejects.toMatchObject({
      issues: [{ path: ["slug"], message: expect.stringContaining(first.slug) }],
    });
  });
});

describe("guards", () => {
  it("MEMBER → ForbiddenError before the input is parsed", async () => {
    // Garbage input proves parsing never ran: a ZodError would mean it did.
    const result = createCourse(MEMBER, { bukan: "kontrak" });
    await expect(result).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listCourses(MEMBER, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listCourses & getCourseDetail", () => {
  it("lists with lesson/quiz counts and per-status totals", async () => {
    const { items, counts } = await listCourses(EDITOR, {});
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const item of items) {
      expect(item.lessonCount).toBe(0);
      expect(item.finalQuizQuestionCount).toBe(0);
    }
    expect(counts.total).toBe(items.length);
    expect(counts.DRAFT).toBe(items.filter((i) => i.status === "DRAFT").length);
    expect(counts.total).toBe(
      counts.DRAFT + counts.IN_REVIEW + counts.PUBLISHED + counts.ARCHIVED,
    );

    const first = items[0];
    if (!first) throw new Error("list item missing");
    const filtered = await listCourses(EDITOR, { status: first.status });
    expect(filtered.items.every((i) => i.status === first.status)).toBe(true);

    const searched = await listCourses(EDITOR, { q: first.title.slice(0, 6) });
    expect(
      searched.items.some((i) => i.id === first.id),
    ).toBe(true);
  });

  it("getCourseDetail returns the DTO and 404s on an unknown id", async () => {
    const created = await createCourse(EDITOR, inputFor("det"));
    const dto = await getCourseDetail(EDITOR, { courseId: created.id });
    expect(dto.id).toBe(created.id);
    expect(dto.finalQuiz).toEqual({ id: expect.any(String), questionCount: 0 });

    await expect(
      getCourseDetail(EDITOR, { courseId: "8f38a3b3-9999-4999-8999-999999999999" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
