// Integration tests for the lesson service over PGlite (card S1-02):
// createLesson's one transaction — lesson + empty LESSON quiz + ONE audit
// row + course touch; order_index/preview rules; slug dedupe including the
// reserved "final-quiz"; the DRAFT lock (409 leaves every table untouched)
// and the 404/403 guards. The setup inserts the quiz.min_questions row
// (card note: every integration file installs it).
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  auditLogs,
  courses,
  lessons,
  quizzes,
  systemSettings,
  users,
} from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

// Same harness pattern as src/modules/course/service.integration.test.ts.
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

import { createCourse } from "@/modules/course/service";
import { createQuestion } from "@/modules/quiz/service";

import {
  createLesson,
  getLessonEditor,
  getLessonInCourse,
  listLessonChecklistRows,
  listLessonOutline,
  updateLessonContent,
} from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

const EDITOR = { id: "u-editor", role: "EDITOR" as const };
const MEMBER = { id: "u-member", role: "MEMBER" as const };

/**
 * Fresh DRAFT course per test. Random tag, NOT a counter: "lsn-kursu-11"
 * still contains "lsn-kursu-1" after normalization and would trip the
 * similar-title guard on later tests.
 */
async function newDraftCourse(): Promise<string> {
  const tag = randomUUID().slice(0, 8);
  const dto = await createCourse(EDITOR, {
    title: `Lsn kursus ${tag}`,
    slug: `lsn-kursus-${tag}`,
    level: "BEGINNER",
    summary: "Ringkasan netral untuk tes.",
  });
  return dto.id;
}

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
      name: "Editor Les",
      email: "editor-lesson@example.com",
      emailVerified: true,
      role: "EDITOR",
    },
    {
      id: MEMBER.id,
      name: "Member Les",
      email: "member-lesson@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
  ]);

  await db
    .insert(systemSettings)
    .values({ key: "quiz.min_questions", value: 10 })
    .onConflictDoNothing({ target: systemSettings.key });
});

afterAll(async () => {
  await pglite.close();
});

describe("createLesson — one transaction", () => {
  it("writes lesson + empty LESSON quiz + one audit row + touches the course", async () => {
    const courseId = await newDraftCourse();
    // Pin the course's updated_at in the past so the touch is provable.
    await db
      .update(courses)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(courses.id, courseId));

    const dto = await createLesson(EDITOR, courseId, {
      title: "Materi pertama les",
    });

    // Lesson row: EMPTY_DOC content, linked quiz, first lesson = preview.
    const [row] = await db.select().from(lessons).where(eq(lessons.id, dto.id));
    if (!row) throw new Error("lesson row missing");
    expect(row.courseId).toBe(courseId);
    expect(row.orderIndex).toBe(1);
    expect(row.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(row.isFreePreview).toBe(true);
    expect(row.quizId).toBe(dto.quizId);
    expect(row.slug).toBe("materi-pertama-les");

    // Quiz row: LESSON with the card's defaults, titled after the lesson.
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, dto.quizId));
    if (!quiz) throw new Error("quiz row missing");
    expect(quiz.type).toBe("LESSON");
    expect(quiz.title).toBe("Materi pertama les");
    expect(quiz.durationMinutes).toBe(10);
    expect(quiz.passingScorePercent).toBe(70);
    expect(quiz.maxAttempts).toBe(1);
    expect(quiz.explanationPolicy).toBe("ALWAYS");

    // Exactly ONE audit row: after = the serialized DTO, ip null.
    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "lesson"), eq(auditLogs.entityId, dto.id)));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorId).toBe(EDITOR.id);
    expect(audits[0]?.action).toBe("lesson.create");
    expect(audits[0]?.before).toBeNull();
    expect(audits[0]?.after).toEqual(dto);
    expect(audits[0]?.ip).toBeNull();

    // Course touched: updated_by = actor, updated_at moved off 2020.
    const [courseRow] = await db
      .select({ updatedBy: courses.updatedBy, updatedAt: courses.updatedAt })
      .from(courses)
      .where(eq(courses.id, courseId));
    expect(courseRow?.updatedBy).toBe(EDITOR.id);
    expect(courseRow?.updatedAt.getFullYear()).toBeGreaterThanOrEqual(2025);

    // 201/audit DTO shape: exactly the allowlist, no content key.
    expect(Object.keys(dto).sort()).toEqual(
      ["courseId", "id", "isFreePreview", "orderIndex", "quizId", "slug", "title"].sort(),
    );
  });

  it("three adds → order_index 1, 2, 3 and only lesson 1 is preview", async () => {
    const courseId = await newDraftCourse();
    const first = await createLesson(EDITOR, courseId, { title: "Les satu" });
    const second = await createLesson(EDITOR, courseId, { title: "Les dua" });
    const third = await createLesson(EDITOR, courseId, { title: "Les tiga" });

    expect([first.orderIndex, second.orderIndex, third.orderIndex]).toEqual([1, 2, 3]);
    expect(first.isFreePreview).toBe(true);
    expect(second.isFreePreview).toBe(false);
    expect(third.isFreePreview).toBe(false);
  });

  it("title 'Final Quiz' → slug not final-quiz", async () => {
    const courseId = await newDraftCourse();
    const dto = await createLesson(EDITOR, courseId, { title: "Final Quiz" });
    expect(dto.slug).not.toBe("final-quiz");
    expect(dto.slug.startsWith("final-quiz")).toBe(true);
  });

  it("two identical titles → different slugs (second suffixed -2)", async () => {
    const courseId = await newDraftCourse();
    const a = await createLesson(EDITOR, courseId, { title: "Les kembar" });
    const b = await createLesson(EDITOR, courseId, { title: "Les kembar" });
    expect(a.slug).toBe("les-kembar");
    expect(b.slug).toBe("les-kembar-2");
  });

  it("two identical 80-char titles → second slug <= 80 ending -2", async () => {
    const courseId = await newDraftCourse();
    const long = "k".repeat(80);
    const a = await createLesson(EDITOR, courseId, { title: long });
    const b = await createLesson(EDITOR, courseId, { title: long });
    expect(a.slug).toBe(long);
    expect(b.slug.length).toBeLessThanOrEqual(80);
    expect(b.slug.endsWith("-2")).toBe(true);
    expect(b.slug).toBe(`${"k".repeat(78)}-2`);
  });

  it("punctuation-only title → slug base 'materi'", async () => {
    const courseId = await newDraftCourse();
    const dto = await createLesson(EDITOR, courseId, { title: "!!! ??? ***" });
    expect(dto.slug).toBe("materi");
  });

  it("non-DRAFT → 409 and lessons/quizzes/audit_logs unchanged", async () => {
    const courseId = await newDraftCourse();
    await db
      .update(courses)
      .set({ status: "IN_REVIEW" })
      .where(eq(courses.id, courseId));

    const lessonsBefore = await db.$count(lessons);
    const quizzesBefore = await db.$count(quizzes);
    const auditsBefore = await db.$count(auditLogs);

    await expect(
      createLesson(EDITOR, courseId, { title: "Les terkunci" }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await db.$count(lessons)).toBe(lessonsBefore);
    expect(await db.$count(quizzes)).toBe(quizzesBefore);
    expect(await db.$count(auditLogs)).toBe(auditsBefore);
  });

  it("unknown course → NotFoundError", async () => {
    await expect(
      createLesson(EDITOR, "8f38a3b3-9999-4999-8999-999999999999", {
        title: "Les hantu",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("MEMBER → ForbiddenError before the input is parsed", async () => {
    const courseId = await newDraftCourse();
    // Garbage input proves parsing never ran: a ZodError would mean it did.
    await expect(
      createLesson(MEMBER, courseId, { bukan: "kontrak" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("empty/overlong titles → ZodError from the shared contract", async () => {
    const courseId = await newDraftCourse();
    await expect(createLesson(EDITOR, courseId, { title: "   " })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(
      createLesson(EDITOR, courseId, { title: "k".repeat(81) }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("listLessonOutline & getLessonInCourse", () => {
  it("outline: ordered rows, computed emptiness, quiz counts, no content key", async () => {
    const courseId = await newDraftCourse();
    const a = await createLesson(EDITOR, courseId, { title: "Outline satu" });
    await createLesson(EDITOR, courseId, { title: "Outline dua" });

    const outline = await listLessonOutline(courseId);
    expect(outline.map((lesson) => lesson.orderIndex)).toEqual([1, 2]);
    for (const lesson of outline) {
      expect(Object.keys(lesson).sort()).toEqual(
        [
          "id",
          "title",
          "orderIndex",
          "isContentEmpty",
          "videoReady",
          "videoDurationSeconds",
          "quizQuestionCount",
          "isFreePreview",
        ].sort(),
      );
      expect(lesson.isContentEmpty).toBe(true); // EMPTY_DOC
      expect(lesson.videoReady).toBe(false);
      expect(lesson.quizQuestionCount).toBe(0);
    }
    expect(outline[0]?.id).toBe(a.id);

    // Content filled → isContentEmpty flips without the doc leaving.
    await db
      .update(lessons)
      .set({
        content: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "isi" }] }],
        },
        videoStatus: "READY",
        videoDurationSeconds: 252,
      })
      .where(eq(lessons.id, a.id));
    const refreshed = await listLessonOutline(courseId);
    expect(refreshed[0]?.isContentEmpty).toBe(false);
    expect(refreshed[0]?.videoReady).toBe(true);
    expect(refreshed[0]?.videoDurationSeconds).toBe(252);
  });

  it("getLessonInCourse: own course → title; other course / unknown → 404", async () => {
    const courseIdA = await newDraftCourse();
    const courseIdB = await newDraftCourse();
    const lesson = await createLesson(EDITOR, courseIdA, { title: "Les milik A" });

    const found = await getLessonInCourse(EDITOR, {
      courseId: courseIdA,
      lessonId: lesson.id,
    });
    expect(found.title).toBe("Les milik A");

    await expect(
      getLessonInCourse(EDITOR, { courseId: courseIdB, lessonId: lesson.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      getLessonInCourse(EDITOR, {
        courseId: courseIdA,
        lessonId: "8f38a3b3-9999-4999-8999-999999999999",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateLessonContent & getLessonEditor (card S1-04)", () => {
  const FILLED_DOC = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Isi materi pertama." }],
      },
    ],
  };

  /** Same document with every object's keys in reverse order — jsonb
   *  re-orders keys, so the no-change compare must be structural. */
  const REORDERED_DOC = {
    content: [
      {
        content: [{ text: "Isi materi pertama.", type: "text" }],
        type: "paragraph",
      },
    ],
    type: "doc",
  };

  async function pinTo2020(courseId: string, lessonId?: string): Promise<void> {
    await db
      .update(courses)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(courses.id, courseId));
    if (lessonId) {
      await db
        .update(lessons)
        .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
        .where(eq(lessons.id, lessonId));
    }
  }

  it("saves the validator-rebuilt doc, touches the course, writes ONE summary-only audit row", async () => {
    const courseId = await newDraftCourse();
    const lesson = await createLesson(EDITOR, courseId, { title: "Les konten" });
    await pinTo2020(courseId, lesson.id);

    const dto = await updateLessonContent(
      EDITOR,
      { courseId, lessonId: lesson.id },
      { content: FILLED_DOC },
    );

    // 200 DTO: id/updatedAt/isContentEmpty — the document never echoes.
    expect(Object.keys(dto).sort()).toEqual(["id", "isContentEmpty", "updatedAt"]);
    expect(dto.id).toBe(lesson.id);
    expect(dto.isContentEmpty).toBe(false);
    expect(new Date(dto.updatedAt).getFullYear()).toBeGreaterThanOrEqual(2025);

    // Stored content = the validated document.
    const [row] = await db
      .select({ content: lessons.content })
      .from(lessons)
      .where(eq(lessons.id, lesson.id));
    expect(row?.content).toEqual(FILLED_DOC);

    // Course touch: updated_by + updated_at moved off 2020.
    const [courseRow] = await db
      .select({ updatedBy: courses.updatedBy, updatedAt: courses.updatedAt })
      .from(courses)
      .where(eq(courses.id, courseId));
    expect(courseRow?.updatedBy).toBe(EDITOR.id);
    expect(courseRow?.updatedAt.getFullYear()).toBeGreaterThanOrEqual(2025);

    // Exactly ONE audit row for the save (lesson.create made its own),
    // summaries only, no document text anywhere.
    const audits = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, "lesson"),
          eq(auditLogs.entityId, lesson.id),
          eq(auditLogs.action, "lesson.update_content"),
        ),
      );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe("lesson.update_content");
    expect(audits[0]?.before).toEqual({ isContentEmpty: true });
    expect(audits[0]?.after).toEqual({ isContentEmpty: false });
    expect(JSON.stringify(audits[0])).not.toContain("Isi materi pertama.");
  });

  it("no change (same doc, different key order) → no write, no audit", async () => {
    const courseId = await newDraftCourse();
    const lesson = await createLesson(EDITOR, courseId, { title: "Les sama" });
    await updateLessonContent(
      EDITOR,
      { courseId, lessonId: lesson.id },
      { content: FILLED_DOC },
    );
    await pinTo2020(courseId, lesson.id);
    const auditsBefore = await db.$count(auditLogs);

    const dto = await updateLessonContent(
      EDITOR,
      { courseId, lessonId: lesson.id },
      { content: REORDERED_DOC },
    );

    expect(dto.isContentEmpty).toBe(false);
    const [row] = await db
      .select({ updatedAt: lessons.updatedAt })
      .from(lessons)
      .where(eq(lessons.id, lesson.id));
    expect(row?.updatedAt.getFullYear()).toBe(2020);
    const [courseRow] = await db
      .select({ updatedAt: courses.updatedAt })
      .from(courses)
      .where(eq(courses.id, courseId));
    expect(courseRow?.updatedAt.getFullYear()).toBe(2020);
    expect(await db.$count(auditLogs)).toBe(auditsBefore);
  });

  it("IN_REVIEW course → 409 and nothing is written", async () => {
    const courseId = await newDraftCourse();
    const lesson = await createLesson(EDITOR, courseId, { title: "Les kunci" });
    await db
      .update(courses)
      .set({ status: "IN_REVIEW" })
      .where(eq(courses.id, courseId));
    const auditsBefore = await db.$count(auditLogs);

    await expect(
      updateLessonContent(EDITOR, { courseId, lessonId: lesson.id }, {
        content: FILLED_DOC,
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    const [row] = await db
      .select({ content: lessons.content })
      .from(lessons)
      .where(eq(lessons.id, lesson.id));
    expect(row?.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(await db.$count(auditLogs)).toBe(auditsBefore);
  });

  it("a lesson of ANOTHER course → 404 (anti-IDOR); unknown ids → 404", async () => {
    const courseIdA = await newDraftCourse();
    const courseIdB = await newDraftCourse();
    const lesson = await createLesson(EDITOR, courseIdA, { title: "Les milik A2" });

    await expect(
      updateLessonContent(EDITOR, { courseId: courseIdB, lessonId: lesson.id }, {
        content: FILLED_DOC,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateLessonContent(
        EDITOR,
        { courseId: courseIdA, lessonId: "8f38a3b3-9999-4999-8999-999999999999" },
        { content: FILLED_DOC },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateLessonContent(
        EDITOR,
        { courseId: "8f38a3b3-9999-4999-8999-999999999999", lessonId: lesson.id },
        { content: FILLED_DOC },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("MEMBER → 403 BEFORE the input is parsed", async () => {
    const courseId = await newDraftCourse();
    const lesson = await createLesson(EDITOR, courseId, { title: "Les peran" });
    // Garbage input proves parsing never ran: a ZodError would mean it did.
    await expect(
      updateLessonContent(MEMBER, { courseId, lessonId: lesson.id }, { bukan: "kontrak" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("V-08: an iframe document → ZodError on content.content.0.type, DB untouched", async () => {
    const courseId = await newDraftCourse();
    const lesson = await createLesson(EDITOR, courseId, { title: "Les v08" });
    const auditsBefore = await db.$count(auditLogs);

    const attempt = updateLessonContent(
      EDITOR,
      { courseId, lessonId: lesson.id },
      { content: { type: "doc", content: [{ type: "iframe" }] } },
    );
    await expect(attempt).rejects.toBeInstanceOf(ZodError);
    // The ZodError itself carries the field path (asserted before the
    // reject rewrote it).
    await attempt.catch((error: unknown) => {
      if (error instanceof ZodError) {
        expect(error.issues[0]?.path).toEqual(["content", "content", 0, "type"]);
      }
    });

    const [row] = await db
      .select({ content: lessons.content })
      .from(lessons)
      .where(eq(lessons.id, lesson.id));
    expect(row?.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(await db.$count(auditLogs)).toBe(auditsBefore);
  });

  it("getLessonEditor: fresh lesson → EMPTY_DOC; cross-course → 404", async () => {
    const courseIdA = await newDraftCourse();
    const courseIdB = await newDraftCourse();
    const lesson = await createLesson(EDITOR, courseIdA, { title: "Les editor" });

    const dto = await getLessonEditor(EDITOR, {
      courseId: courseIdA,
      lessonId: lesson.id,
    });
    expect(dto).toEqual({
      course: { id: courseIdA, title: expect.any(String), status: "DRAFT" },
      lesson: {
        id: lesson.id,
        title: "Les editor",
        orderIndex: 1,
        content: { type: "doc", content: [{ type: "paragraph" }] },
        // The quiz CRS-06 created together with the lesson, still empty,
        // plus the publish minimum from the seeded settings (S1-09 §5).
        quizId: lesson.quizId,
        quizQuestionCount: 0,
      },
      minQuestions: 10,
    });

    await expect(
      getLessonEditor(EDITOR, { courseId: courseIdB, lessonId: lesson.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      getLessonEditor(EDITOR, {
        courseId: courseIdA,
        lessonId: "8f38a3b3-9999-4999-8999-999999999999",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// -------------------------- checklist rows for the publish gate (card S1-08 §1)

describe("listLessonChecklistRows — the gate's outline read (card S1-08 §1)", () => {
  const PG_INPUT = {
    type: "SINGLE_CHOICE",
    text: "Pertanyaan checklist",
    explanation: "Pembahasan checklist",
    options: [
      { text: "Opsi satu", isCorrect: true },
      { text: "Opsi dua", isCorrect: false },
      { text: "Opsi tiga", isCorrect: false },
      { text: "Opsi empat", isCorrect: false },
    ],
  } as const;

  const FILLED_DOC = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Isi materi checklist." }],
      },
    ],
  };

  it("returns orderIndex/emptiness/quizId/counts inside a transaction, matching the outline", async () => {
    const courseId = await newDraftCourse();
    const first = await createLesson(EDITOR, courseId, {
      title: "Materi checklist satu",
    });
    const second = await createLesson(EDITOR, courseId, {
      title: "Materi checklist dua",
    });
    await updateLessonContent(
      EDITOR,
      { courseId, lessonId: first.id },
      { content: FILLED_DOC },
    );
    await createQuestion(EDITOR, { quizId: first.quizId }, PG_INPUT);
    await createQuestion(EDITOR, { quizId: first.quizId }, PG_INPUT);

    // The gate always calls this INSIDE its transaction, after the lock.
    const rows = await db.transaction(async (tx) =>
      listLessonChecklistRows(tx, courseId),
    );
    expect(rows).toEqual([
      {
        orderIndex: 1,
        isContentEmpty: false,
        quizId: first.quizId,
        quizQuestionCount: 2,
      },
      {
        orderIndex: 2,
        isContentEmpty: true,
        quizId: second.quizId,
        quizQuestionCount: 0,
      },
    ]);

    // ONE source: the same facts the builder outline shows.
    const outline = await listLessonOutline(courseId);
    expect(
      rows.map((row) => ({
        orderIndex: row.orderIndex,
        isContentEmpty: row.isContentEmpty,
        quizQuestionCount: row.quizQuestionCount,
      })),
    ).toEqual(
      outline.map((item) => ({
        orderIndex: item.orderIndex,
        isContentEmpty: item.isContentEmpty,
        quizQuestionCount: item.quizQuestionCount,
      })),
    );
  });

  it("answers [] for a course without lessons", async () => {
    const courseId = await newDraftCourse();
    const rows = await db.transaction(async (tx) =>
      listLessonChecklistRows(tx, courseId),
    );
    expect(rows).toEqual([]);
  });
});
