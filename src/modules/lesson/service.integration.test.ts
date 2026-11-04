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
import { createLesson, getLessonInCourse, listLessonOutline } from "./service";

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
