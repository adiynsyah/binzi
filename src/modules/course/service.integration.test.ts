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
//
// Card S1-02 additions:
// - updateCourse (PATCH): every-field save with ONE course.update audit row
//   carrying before/after builder DTOs; no-op save writes and audits
//   nothing; similar-title/slug checks only fire when that field changed
//   (own title extended or case-only → 200); other course's title/slug and
//   forbidden slug → ZodError field errors; non-DRAFT → 409 with the row
//   untouched; isSequential-only save audits before ≠ after.
// - getCourseBuilder: course + outline + checklist + minQuestions in one
//   call; the TipTap description never crosses (review addition 2a).
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { auditLogs, courses, quizzes, systemSettings, users } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

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
import type { UpdateCourseInput } from "./schema";
import {
  createCourse,
  getCourseBuilder,
  getCourseDescriptionEditor,
  getCourseDetail,
  listCourses,
  updateCourse,
  updateCourseDescription,
} from "./service";

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

  // getCourseBuilder reads this fail-closed setting (card note: every
  // integration file installs it).
  await db
    .insert(systemSettings)
    .values({ key: "quiz.min_questions", value: 10 })
    .onConflictDoNothing({ target: systemSettings.key });
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

  it("identical title (auto-slug identical too) → path title, not slug", async () => {
    // Review item 2: the same title produces the same auto-slug, so BOTH
    // pre-checks would fire — the TITLE error must win (fixing the title
    // fixes the auto-slug; the slug branch is for hand-edited slugs).
    const first = await createCourse(EDITOR, inputFor("idt"));
    const result = createCourse(EDITOR, {
      title: first.title,
      slug: first.slug,
      level: "BEGINNER",
      summary: "Ringkasan netral untuk tes.",
    });
    await expect(result).rejects.toBeInstanceOf(ZodError);
    await expect(result).rejects.toMatchObject({
      issues: [{ path: ["title"] }],
    });
    await expect(result).rejects.not.toMatchObject({
      issues: [{ path: ["slug"] }],
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

    // Rollback proof (review item 5): the FINAL quiz is inserted FIRST in
    // the transaction, so a failing course insert must take the quiz row
    // (and the audit row) down with it.
    const quizzesBefore = await db.$count(quizzes);
    const auditsBefore = await db.$count(auditLogs);

    const result = courseQueries.createCourseWithFinalQuiz(
      { ...inputFor("uq"), slug: first.slug },
      EDITOR.id,
    );
    await expect(result).rejects.toBeInstanceOf(ZodError);
    await expect(result).rejects.toMatchObject({
      issues: [{ path: ["slug"], message: expect.stringContaining(first.slug) }],
    });

    expect(await db.$count(quizzes)).toBe(quizzesBefore);
    expect(await db.$count(auditLogs)).toBe(auditsBefore);
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

// ------------------------------------------------------ builder (card S1-02)

type BuilderCourse = Awaited<ReturnType<typeof getCourseBuilder>>["course"];

/** The settings form payload echoing a course's current values. */
function settingsFrom(
  course: BuilderCourse,
  overrides: Partial<UpdateCourseInput> = {},
): UpdateCourseInput {
  return {
    title: course.title,
    slug: course.slug,
    level: course.level,
    summary: course.summary ?? "",
    isSequential: course.isSequential,
    ...overrides,
  };
}

async function courseAudits(courseId: string) {
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, "course"), eq(auditLogs.entityId, courseId)));
}

describe("updateCourse — PATCH builder settings (S1-02 §2)", () => {
  it("changes every field, writes ONE audit row with before/after builder DTOs", async () => {
    const created = await createCourse(EDITOR, inputFor("upd"));
    const { course: before } = await getCourseBuilder(EDITOR, { courseId: created.id });
    await expect(courseAudits(created.id)).resolves.toHaveLength(1); // just course.create

    const dto = await updateCourse(EDITOR, created.id, {
      title: `${before.title} revisi`,
      slug: `${before.slug}-revisi`,
      summary: "Ringkasan baru setelah simpan pengaturan.",
      level: "ADVANCED",
      // Column default is true (CRS-08) — flip to prove the field persists.
      isSequential: false,
    });

    expect(dto.title).toBe(`${before.title} revisi`);
    expect(dto.slug).toBe(`${before.slug}-revisi`);
    expect(dto.summary).toBe("Ringkasan baru setelah simpan pengaturan.");
    expect(dto.level).toBe("ADVANCED");
    expect(dto.isSequential).toBe(false);
    expect(dto.status).toBe("DRAFT");
    // Review addition 2a: the PATCH response is a builder DTO — the TipTap
    // description never crosses, only isDescriptionEmpty does.
    expect("description" in dto).toBe(false);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "title",
        "slug",
        "summary",
        "level",
        "status",
        "isSequential",
        "isDescriptionEmpty",
        "ownerName",
        "updatedAt",
        "finalQuiz",
      ].sort(),
    );

    // updated_by moved to the actor.
    const [row] = await db
      .select({ updatedBy: courses.updatedBy })
      .from(courses)
      .where(eq(courses.id, created.id));
    expect(row?.updatedBy).toBe(EDITOR.id);

    // Exactly ONE new audit row; before/after are the builder DTOs (CMS-12).
    const audits = await courseAudits(created.id);
    expect(audits).toHaveLength(2);
    const update = audits.find((a) => a.action === "course.update");
    if (!update) throw new Error("course.update audit row missing");
    expect(update.actorId).toBe(EDITOR.id);
    expect(update.ip).toBeNull();
    expect(update.before).toEqual(before);
    expect(update.after).toEqual(dto);
  });

  it("no change → current DTO back, no write, no audit", async () => {
    const created = await createCourse(EDITOR, inputFor("nc"));
    await db
      .update(courses)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(courses.id, created.id));

    const { course } = await getCourseBuilder(EDITOR, { courseId: created.id });
    const dto = await updateCourse(EDITOR, created.id, settingsFrom(course));

    expect(dto).toEqual(course);
    // Still only course.create — the no-op save audited nothing.
    expect(await courseAudits(created.id)).toHaveLength(1);
    const [row] = await db
      .select({ updatedAt: courses.updatedAt, updatedBy: courses.updatedBy })
      .from(courses)
      .where(eq(courses.id, created.id));
    expect(row?.updatedAt.getFullYear()).toBe(2020); // untouched
    expect(row?.updatedBy).toBe(EDITOR.id);
  });

  it("own title extended → 200 (self excluded from the similar-title check)", async () => {
    // Review addition 4: "judul-diem-diperpanjang" — the new title starts
    // with the course's OWN title, which must never block the save.
    const created = await createCourse(EDITOR, inputFor("own"));
    const { course } = await getCourseBuilder(EDITOR, { courseId: created.id });
    const dto = await updateCourse(
      EDITOR,
      created.id,
      settingsFrom(course, { title: `${course.title} lanjutan` }),
    );
    expect(dto.title).toBe(`${course.title} lanjutan`);
  });

  it("case-only title change → 200 (normalized comparison, change still written)", async () => {
    const created = await createCourse(EDITOR, inputFor("case"));
    const { course } = await getCourseBuilder(EDITOR, { courseId: created.id });
    const dto = await updateCourse(
      EDITOR,
      created.id,
      settingsFrom(course, { title: course.title.toUpperCase() }),
    );
    expect(dto.title).toBe(course.title.toUpperCase());
    const audits = await courseAudits(created.id);
    expect(audits.some((a) => a.action === "course.update")).toBe(true);
  });

  it("another course's similar title → ZodError path title", async () => {
    const other = await createCourse(EDITOR, inputFor("oth"));
    const created = await createCourse(EDITOR, inputFor("tgt"));
    const { course } = await getCourseBuilder(EDITOR, { courseId: created.id });
    await expect(
      updateCourse(
        EDITOR,
        created.id,
        settingsFrom(course, { title: `${other.title} ekstra` }),
      ),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      updateCourse(
        EDITOR,
        created.id,
        settingsFrom(course, { title: `${other.title} ekstra` }),
      ),
    ).rejects.toMatchObject({ issues: [{ path: ["title"] }] });
  });

  it("another course's slug → ZodError path slug", async () => {
    const other = await createCourse(EDITOR, inputFor("slg"));
    const created = await createCourse(EDITOR, inputFor("slgt"));
    const { course } = await getCourseBuilder(EDITOR, { courseId: created.id });
    await expect(
      updateCourse(EDITOR, created.id, settingsFrom(course, { slug: other.slug })),
    ).rejects.toMatchObject({ issues: [{ path: ["slug"] }] });
  });

  it("forbidden slug → ZodError path slug (schema rule)", async () => {
    const created = await createCourse(EDITOR, inputFor("forb2"));
    const { course } = await getCourseBuilder(EDITOR, { courseId: created.id });
    await expect(
      updateCourse(EDITOR, created.id, settingsFrom(course, { slug: "nilai" })),
    ).rejects.toMatchObject({
      issues: [{ path: ["slug"], message: expect.stringContaining("nilai") }],
    });
  });

  it("isSequential-only change → audit with before ≠ after", async () => {
    // Review addition 2a: without isSequential in the DTO this save would
    // audit before === after. Column default is true (CRS-08) — flip it off.
    const created = await createCourse(EDITOR, inputFor("seq"));
    const { course } = await getCourseBuilder(EDITOR, { courseId: created.id });
    expect(course.isSequential).toBe(true);

    const dto = await updateCourse(
      EDITOR,
      created.id,
      settingsFrom(course, { isSequential: false }),
    );
    expect(dto.isSequential).toBe(false);

    const update = (await courseAudits(created.id)).find(
      (a) => a.action === "course.update",
    );
    if (!update) throw new Error("course.update audit row missing");
    const before = update.before as Record<string, unknown>;
    const after = update.after as Record<string, unknown>;
    expect(before).not.toEqual(after);
    // Everything except the switch (and the moved updated_at) is identical.
    expect({ ...before, isSequential: false, updatedAt: after.updatedAt }).toEqual(after);
  });

  it("non-DRAFT → ConflictError and the row is untouched", async () => {
    const created = await createCourse(EDITOR, inputFor("lock"));
    await db
      .update(courses)
      .set({ status: "IN_REVIEW" })
      .where(eq(courses.id, created.id));
    const [pinned] = await db
      .select({
        title: courses.title,
        updatedAt: courses.updatedAt,
        updatedBy: courses.updatedBy,
      })
      .from(courses)
      .where(eq(courses.id, created.id));
    if (!pinned) throw new Error("course row missing");

    const { course } = await getCourseBuilder(EDITOR, { courseId: created.id });
    await expect(
      updateCourse(EDITOR, created.id, settingsFrom(course, { summary: "Tidak tersimpan." })),
    ).rejects.toBeInstanceOf(ConflictError);

    const [after] = await db
      .select({
        title: courses.title,
        updatedAt: courses.updatedAt,
        updatedBy: courses.updatedBy,
      })
      .from(courses)
      .where(eq(courses.id, created.id));
    expect(after).toEqual(pinned);
    expect(await courseAudits(created.id)).toHaveLength(1); // only course.create
  });

  it("unknown course → NotFoundError", async () => {
    const other = await createCourse(EDITOR, inputFor("unk"));
    const { course } = await getCourseBuilder(EDITOR, { courseId: other.id });
    await expect(
      updateCourse(EDITOR, "8f38a3b3-9999-4999-8999-999999999999", settingsFrom(course)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("MEMBER → ForbiddenError before the input is parsed", async () => {
    const created = await createCourse(EDITOR, inputFor("mem"));
    await expect(
      updateCourse(MEMBER, created.id, { bukan: "kontrak" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("getCourseBuilder — the whole page in one call (S1-02 §5)", () => {
  it("returns course + outline + checklist + minQuestions, description never crossing", async () => {
    const created = await createCourse(EDITOR, inputFor("bld"));
    const builder = await getCourseBuilder(EDITOR, { courseId: created.id });

    expect(builder.minQuestions).toBe(10);
    expect(builder.outline).toEqual([]);
    expect("description" in builder.course).toBe(false);
    expect(builder.course.finalQuiz).toEqual({
      id: expect.any(String),
      questionCount: 0,
      durationMinutes: 20,
    });

    // Wiring: the fresh course's rows feed the evaluator (CMS-06) — a new
    // course meets exactly the three filled-at-create items.
    expect(builder.checklist.total).toBe(6);
    expect(builder.checklist.met).toBe(3);
    expect(builder.checklist.missing).toEqual([
      "Deskripsi kursus belum diisi",
      "Belum ada materi",
      "Final Quiz baru 0 dari 10 soal",
    ]);
    expect(builder.checklist.items.map((item) => item.label)).toContain(
      "Final Quiz ≥ 10 soal",
    );
  });

  it("unknown id → NotFoundError; MEMBER → ForbiddenError before parsing", async () => {
    await expect(
      getCourseBuilder(EDITOR, { courseId: "8f38a3b3-9999-4999-8999-999999999999" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCourseBuilder(MEMBER, { bukan: "kontrak" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("updateCourseDescription & getCourseDescriptionEditor (card S1-04)", () => {
  const FILLED_DOC = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Untuk ahli gizi baru." }],
      },
    ],
  };

  /** Same document with every object's keys in reverse order — jsonb
   *  re-orders keys, so the no-change compare must be structural. */
  const REORDERED_DOC = {
    content: [
      {
        content: [{ text: "Untuk ahli gizi baru.", type: "text" }],
        type: "paragraph",
      },
    ],
    type: "doc",
  };

  it("saves the validator-rebuilt doc and writes ONE summary-only audit row", async () => {
    const input = inputFor("dsk");
    const created = await createCourse(EDITOR, input);
    // Pin updated_at in the past so a would-be touch would be provable.
    await db
      .update(courses)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(courses.id, created.id));

    const dto = await updateCourseDescription(EDITOR, created.id, {
      description: FILLED_DOC,
    });

    // 200 DTO: id/updatedAt/isDescriptionEmpty — no document echo.
    expect(Object.keys(dto).sort()).toEqual([
      "id",
      "isDescriptionEmpty",
      "updatedAt",
    ]);
    expect(dto.id).toBe(created.id);
    expect(dto.isDescriptionEmpty).toBe(false);

    // Stored description = the validated document.
    const [row] = await db
      .select({ description: courses.description })
      .from(courses)
      .where(eq(courses.id, created.id));
    expect(row?.description).toEqual(FILLED_DOC);

    // Exactly ONE audit row for the save (course.create made its own),
    // summaries only, no document text anywhere.
    const audits = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, "course"),
          eq(auditLogs.entityId, created.id),
          eq(auditLogs.action, "course.update_description"),
        ),
      );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.before).toEqual({ isDescriptionEmpty: true });
    expect(audits[0]?.after).toEqual({ isDescriptionEmpty: false });
    expect(JSON.stringify(audits[0])).not.toContain("Untuk ahli gizi baru.");
  });

  it("no change (same doc, different key order) → no write, no audit", async () => {
    const input = inputFor("dsk");
    const created = await createCourse(EDITOR, input);
    await updateCourseDescription(EDITOR, created.id, {
      description: FILLED_DOC,
    });
    await db
      .update(courses)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(courses.id, created.id));
    const auditsBefore = await db.$count(auditLogs);

    const dto = await updateCourseDescription(EDITOR, created.id, {
      description: REORDERED_DOC,
    });

    expect(dto.isDescriptionEmpty).toBe(false);
    const [row] = await db
      .select({ updatedAt: courses.updatedAt })
      .from(courses)
      .where(eq(courses.id, created.id));
    expect(row?.updatedAt.getFullYear()).toBe(2020);
    expect(await db.$count(auditLogs)).toBe(auditsBefore);
  });

  it("non-DRAFT → 409 and the description stays null", async () => {
    const input = inputFor("dsk");
    const created = await createCourse(EDITOR, input);
    await db
      .update(courses)
      .set({ status: "IN_REVIEW" })
      .where(eq(courses.id, created.id));
    const auditsBefore = await db.$count(auditLogs);

    await expect(
      updateCourseDescription(EDITOR, created.id, { description: FILLED_DOC }),
    ).rejects.toBeInstanceOf(ConflictError);

    const [row] = await db
      .select({ description: courses.description })
      .from(courses)
      .where(eq(courses.id, created.id));
    expect(row?.description).toBeNull();
    expect(await db.$count(auditLogs)).toBe(auditsBefore);
  });

  it("unknown course → 404; MEMBER → 403 BEFORE the input is parsed", async () => {
    await expect(
      updateCourseDescription(EDITOR, "8f38a3b3-9999-4999-8999-999999999999", {
        description: FILLED_DOC,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    // Garbage input proves parsing never ran: a ZodError would mean it did.
    await expect(
      updateCourseDescription(MEMBER, "whatever", { bukan: "kontrak" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("V-08: an iframe document → ZodError on description.content.0.type, DB untouched", async () => {
    const input = inputFor("dsk");
    const created = await createCourse(EDITOR, input);
    const auditsBefore = await db.$count(auditLogs);

    const attempt = updateCourseDescription(EDITOR, created.id, {
      description: { type: "doc", content: [{ type: "iframe" }] },
    });
    await expect(attempt).rejects.toBeInstanceOf(ZodError);
    await attempt.catch((error: unknown) => {
      if (error instanceof ZodError) {
        expect(error.issues[0]?.path).toEqual([
          "description",
          "content",
          0,
          "type",
        ]);
      }
    });

    const [row] = await db
      .select({ description: courses.description })
      .from(courses)
      .where(eq(courses.id, created.id));
    expect(row?.description).toBeNull();
    expect(await db.$count(auditLogs)).toBe(auditsBefore);
  });

  it("getCourseDescriptionEditor: null → EMPTY_DOC; unknown → 404; MEMBER → 403", async () => {
    const input = inputFor("dsk");
    const created = await createCourse(EDITOR, input);

    const dto = await getCourseDescriptionEditor(EDITOR, {
      courseId: created.id,
    });
    expect(dto).toEqual({
      id: created.id,
      title: input.title,
      status: "DRAFT",
      description: { type: "doc", content: [{ type: "paragraph" }] },
    });

    await expect(
      getCourseDescriptionEditor(EDITOR, {
        courseId: "8f38a3b3-9999-4999-8999-999999999999",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      getCourseDescriptionEditor(MEMBER, { bukan: "kontrak" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
