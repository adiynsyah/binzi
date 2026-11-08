// Database access for the lesson domain (card S1-02).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
//
// Import direction is ONE WAY (card §1): course → lesson → quiz. This
// module reads the courses TABLE directly (lock + status + touch) in its
// own queries — it must not import the course MODULE, which would close a
// circle course → lesson → course.
//
// Every query selects an explicit column allowlist (never select *).
import "server-only";

import { isDeepStrictEqual } from "node:util";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, courses, lessons, questions } from "@/db/schema";
import { EMPTY_DOC, type ContentDoc } from "@/lib/content-doc";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { slugify, uniquifySlug } from "@/lib/slug";
import { createEmptyLessonQuiz } from "@/modules/quiz/service";

import {
  contentAuditSummary,
  toCreatedLessonDTO,
  toLessonEditorDTO,
  toLessonOutlineItemDTO,
  toUpdatedLessonContentDTO,
  type CreatedLessonDTO,
  type LessonEditorDTO,
  type LessonOutlineItemDTO,
  type UpdatedLessonContentDTO,
} from "./serializer";

// Correlated count resolved inside the one SELECT (no N+1) — same shape as
// finalQuizQuestionCountSql in the course module. mapWith(Number): drivers
// hand back bigint counts as strings.
const quizQuestionCountSql = sql<number>`(
  select count(*) from ${questions}
  where ${questions.quizId} = ${lessons.quizId}
)`.mapWith(Number);

/**
 * 409 copy for the DRAFT lock (card §6, agent-proposed — listed in the PR).
 * Twin of NOT_DRAFT_MESSAGE in the course module's errors.ts: the import
 * direction forbids sharing it across module internals, and it is copy, not
 * behavior.
 */
export const NOT_DRAFT_MESSAGE =
  "Kursus sudah bukan draf — hanya draf yang bisa diubah.";

/** Builder outline (21a), ordered by order_index. */
export async function listOutlineByCourseId(
  courseId: string,
): Promise<LessonOutlineItemDTO[]> {
  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      orderIndex: lessons.orderIndex,
      content: lessons.content,
      videoStatus: lessons.videoStatus,
      videoDurationSeconds: lessons.videoDurationSeconds,
      isFreePreview: lessons.isFreePreview,
      quizQuestionCount: quizQuestionCountSql,
    })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.orderIndex));
  return rows.map(toLessonOutlineItemDTO);
}

/** Lesson title lookup for the editor placeholder page (must belong to the course). */
export async function findLessonTitleInCourse(
  courseId: string,
  lessonId: string,
): Promise<{ id: string; title: string } | undefined> {
  const rows = await db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
    .limit(1);
  return rows[0];
}

/**
 * Create lesson + empty LESSON quiz + audit row + course touch in ONE
 * transaction (card S1-02 §4). The course row is locked FOR UPDATE first,
 * so the DRAFT check and the order_index/slug computations below run on a
 * stable row — two concurrent adds serialize here instead of racing to the
 * same order_index. (PGlite runs on one connection, so the tests cannot
 * prove the locking; correctness is by code review, card note.)
 */
export async function createLessonWithQuiz(input: {
  courseId: string;
  title: string;
  actorId: string;
}): Promise<CreatedLessonDTO> {
  return db.transaction(async (tx) => {
    // 1. Lock + status gate.
    const lockedRows = await tx
      .select({ id: courses.id, status: courses.status })
      .from(courses)
      .where(eq(courses.id, input.courseId))
      .limit(1)
      .for("update");
    const course = lockedRows[0];
    if (!course) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }
    if (course.status !== "DRAFT") {
      throw new ConflictError(NOT_DRAFT_MESSAGE);
    }

    // 2. order_index = max + 1, starting at 1, gapless (same shape as the
    // demo seed). Computed under the lock.
    const maxRows = await tx
      .select({
        max: sql<number>`max(${lessons.orderIndex})`.mapWith(Number),
      })
      .from(lessons)
      .where(eq(lessons.courseId, input.courseId));
    const orderIndex = (maxRows[0]?.max ?? 0) + 1;

    // 3. Slug from the title with the SHARED slugify (courses use the same
    // rule); reserved/taken bases get -2, -3, … The slug is never a user
    // error — it just needs to be unique within this course.
    const existingSlugs = await tx
      .select({ slug: lessons.slug })
      .from(lessons)
      .where(eq(lessons.courseId, input.courseId));
    const taken = new Set(existingSlugs.map((row) => row.slug));
    taken.add("final-quiz"); // never shadow the Final Quiz route name
    const base = slugify(input.title) || "materi";
    const slug = uniquifySlug(base, (candidate) => taken.has(candidate));

    // 4. The lesson's quiz FIRST (CRS-06: exactly one, created together).
    const quiz = await createEmptyLessonQuiz(tx, { title: input.title });

    // 5. The lesson row: empty content, linked quiz, first lesson = free
    // preview (21g "Materi pertama otomatis jadi preview gratis").
    const inserted = await tx
      .insert(lessons)
      .values({
        courseId: input.courseId,
        title: input.title,
        slug,
        orderIndex,
        content: EMPTY_DOC,
        quizId: quiz.id,
        isFreePreview: orderIndex === 1,
      })
      // Explicit column list (src/modules/README.md).
      .returning({
        id: lessons.id,
        courseId: lessons.courseId,
        title: lessons.title,
        slug: lessons.slug,
        orderIndex: lessons.orderIndex,
        quizId: lessons.quizId,
        isFreePreview: lessons.isFreePreview,
      });
    const row = inserted[0];
    if (!row) {
      throw new Error("createLessonWithQuiz: insert returned no row");
    }
    const dto = toCreatedLessonDTO(row);

    // 6. Touch the course so "terakhir diubah" in the list moves (card §4
    // step 5). $onUpdate stamps updated_at with the same write.
    await tx
      .update(courses)
      .set({ updatedBy: input.actorId })
      .where(eq(courses.id, input.courseId));

    // 7. Audit (CMS-12): after = the serialized DTO.
    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "lesson.create",
      entityType: "lesson",
      entityId: dto.id,
      before: null,
      after: dto,
      ip: null,
    });

    return dto;
  });
}

// -------------------------------------------------- content save (card S1-04)

/**
 * Save the lesson text of a DRAFT course in ONE transaction (card S1-04
 * §2). Same lock order as createLessonWithQuiz:
 *   1. SELECT … FOR UPDATE the course row → 404 / 409 NOT_DRAFT;
 *   2. SELECT … FOR UPDATE the lesson row scoped `id AND course_id` →
 *      404, including a lesson that belongs to another course (the
 *      anti-IDOR shape of the page);
 *   3. no change (deep-structural compare — jsonb re-orders keys, so
 *      stringifying is never the test) → current DTO back, no write, no
 *      audit;
 *   4. change → content = the VALIDATOR-REBUILT document (never the raw
 *      input), one course touch so "terakhir diubah" moves, ONE audit row
 *      whose before/after are { isContentEmpty } summaries only.
 */
export async function updateLessonContentIfDraft(input: {
  courseId: string;
  lessonId: string;
  values: { content: ContentDoc };
  actorId: string;
}): Promise<{ dto: UpdatedLessonContentDTO; changed: boolean }> {
  return db.transaction(async (tx) => {
    // 1. Lock + status gate.
    const lockedCourses = await tx
      .select({ id: courses.id, status: courses.status })
      .from(courses)
      .where(eq(courses.id, input.courseId))
      .limit(1)
      .for("update");
    const course = lockedCourses[0];
    if (!course) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }
    if (course.status !== "DRAFT") {
      throw new ConflictError(NOT_DRAFT_MESSAGE);
    }

    // 2. Lock the lesson row — scoped to this course.
    const lockedLessons = await tx
      .select({
        id: lessons.id,
        content: lessons.content,
        updatedAt: lessons.updatedAt,
      })
      .from(lessons)
      .where(
        and(eq(lessons.id, input.lessonId), eq(lessons.courseId, input.courseId)),
      )
      .limit(1)
      .for("update");
    const current = lockedLessons[0];
    if (!current) {
      throw new NotFoundError("Materi tidak ditemukan");
    }

    // 3. Nothing actually changed → no write, no audit (card §2 step 3).
    if (isDeepStrictEqual(current.content, input.values.content)) {
      return { dto: toUpdatedLessonContentDTO(current), changed: false };
    }

    // 4. Write the validated document, touch the course, audit summaries.
    const before = contentAuditSummary(current.content);
    const updatedRows = await tx
      .update(lessons)
      .set({ content: input.values.content })
      .where(eq(lessons.id, input.lessonId))
      .returning({
        id: lessons.id,
        content: lessons.content,
        updatedAt: lessons.updatedAt,
      });
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("updateLessonContentIfDraft: update returned no row");
    }

    // Same touch as createLessonWithQuiz: updated_by moves updated_at via
    // $onUpdate, so the course list's "terakhir diubah" follows the edit.
    await tx
      .update(courses)
      .set({ updatedBy: input.actorId })
      .where(eq(courses.id, input.courseId));

    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "lesson.update_content",
      entityType: "lesson",
      entityId: input.lessonId,
      // { isContentEmpty } only — no TipTap document in the audit trail
      // (review rule 2a).
      before,
      after: contentAuditSummary(updated.content),
      ip: null,
    });

    return { dto: toUpdatedLessonContentDTO(updated), changed: true };
  });
}

/**
 * The editor page's lookup (card S1-04 §5): one joined row — the lesson
 * scoped to the course (anti-IDOR 404) plus the course's title/status.
 */
export async function findLessonEditorById(
  courseId: string,
  lessonId: string,
  minQuestions: number,
): Promise<LessonEditorDTO | undefined> {
  const rows = await db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseStatus: courses.status,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      orderIndex: lessons.orderIndex,
      content: lessons.content,
      quizId: lessons.quizId,
      quizQuestionCount: quizQuestionCountSql,
    })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return toLessonEditorDTO(
    { id: row.courseId, title: row.courseTitle, status: row.courseStatus },
    {
      id: row.lessonId,
      title: row.lessonTitle,
      orderIndex: row.orderIndex,
      content: row.content,
      quizId: row.quizId,
      quizQuestionCount: row.quizQuestionCount,
    },
    minQuestions,
  );
}
