// Database access for the course domain (card S1-01).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
//
// Every query selects an explicit column allowlist (never select *).
// createCourseWithFinalQuiz owns ONE transaction that writes the course,
// its empty FINAL quiz (via @/modules/quiz/service — the module's public
// door, called with this transaction's handle), and the audit row.
import "server-only";

import { and, count, desc, eq, ilike, ne, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  courses,
  lessons,
  questions,
  quizzes,
  users,
} from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { createEmptyFinalQuiz } from "@/modules/quiz/service";

import { isUniqueViolation } from "./db-errors";
import {
  courseFieldError,
  NOT_DRAFT_MESSAGE,
  SIMILAR_TITLE_MESSAGE,
  SLUG_TAKEN_MESSAGE,
} from "./errors";

import {
  toCmsCourseBuilderDTO,
  toCmsCourseDetailDTO,
  type CourseBuilderRow,
} from "./serializer";
import type {
  CourseListItemRow,
  CourseDetailRow,
  CourseStatusCounts,
} from "./serializer";
import type {
  ContentStatus,
  CreateCourseInput,
  UpdateCourseInput,
} from "./schema";

// Subquery aggregates (no N+1): correlated counts resolved inside the one
// SELECT. mapWith(Number) — drivers hand back bigint counts as strings.
const lessonCountSql = sql<number>`(
  select count(*) from ${lessons} where ${lessons.courseId} = ${courses.id}
)`.mapWith(Number);

const finalQuizQuestionCountSql = sql<number>`(
  select count(*) from ${questions}
  where ${questions.quizId} = ${courses.finalQuizId}
)`.mapWith(Number);

// 21a "n soal · d menit · …": the FINAL quiz's duration rides the same
// single SELECT.
const finalQuizDurationSql = sql<number | null>`(
  select ${quizzes.durationMinutes} from ${quizzes}
  where ${quizzes.id} = ${courses.finalQuizId}
)`;

const ownerColumns = {
  ownerName: users.name,
  ownerEmail: users.email,
};

// PG LIKE treats backslash as the escape character by default, so % and _
// typed by the user must be escaped to keep them literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** CMS list (21e), default sort "terakhir diubah". */
export async function listCourses(filter: {
  status?: ContentStatus;
  q?: string;
}): Promise<CourseListItemRow[]> {
  const conditions: SQL[] = [];
  if (filter.status !== undefined) {
    conditions.push(eq(courses.status, filter.status));
  }
  if (filter.q !== undefined) {
    conditions.push(ilike(courses.title, `%${escapeLike(filter.q)}%`));
  }

  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      level: courses.level,
      status: courses.status,
      enrollmentCount: courses.enrollmentCount,
      updatedAt: courses.updatedAt,
      ...ownerColumns,
      lessonCount: lessonCountSql,
      finalQuizQuestionCount: finalQuizQuestionCountSql,
    })
    .from(courses)
    .innerJoin(users, eq(courses.createdBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(courses.updatedAt), desc(courses.id));
}

/** Totals per status across ALL courses — never affected by the filter. */
export async function countCoursesByStatus(): Promise<CourseStatusCounts> {
  const rows = await db
    .select({ status: courses.status, value: count().mapWith(Number) })
    .from(courses)
    .groupBy(courses.status);

  const counts: CourseStatusCounts = {
    total: 0,
    DRAFT: 0,
    IN_REVIEW: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.value;
    counts.total += row.value;
  }
  return counts;
}

/** Builder lookup (21g). */
export async function findCourseById(
  courseId: string,
): Promise<CourseDetailRow | undefined> {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      summary: courses.summary,
      description: courses.description,
      thumbnailUrl: courses.thumbnailUrl,
      level: courses.level,
      status: courses.status,
      estimatedMinutes: courses.estimatedMinutes,
      publishedAt: courses.publishedAt,
      finalQuizId: courses.finalQuizId,
      enrollmentCount: courses.enrollmentCount,
      updatedAt: courses.updatedAt,
      ...ownerColumns,
      finalQuizQuestionCount: finalQuizQuestionCountSql,
    })
    .from(courses)
    .innerJoin(users, eq(courses.createdBy, users.id))
    .where(eq(courses.id, courseId))
    .limit(1);
  return rows[0];
}

/** Duplicate-slug pre-check (the unique index remains the last line of
 *  defense for concurrent requests — see createCourseWithFinalQuiz). */
export async function slugExists(slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  return rows.length > 0;
}

/** Titles of ALL courses, any status (the similar-title rule compares
 *  against ARCHIVED courses too — card S1-01). */
export async function listCourseTitles(): Promise<
  { id: string; title: string }[]
> {
  return db.select({ id: courses.id, title: courses.title }).from(courses);
}

/**
 * Create course + empty FINAL quiz + audit row in ONE transaction.
 *
 * The unique violation on courses.slug (two concurrent requests that both
 * pass the service pre-check) is mapped here to the same field error the
 * pre-check produces; any OTHER 23505 is rethrown untouched.
 */
export async function createCourseWithFinalQuiz(
  input: CreateCourseInput,
  actorId: string,
): Promise<ReturnType<typeof toCmsCourseDetailDTO>> {
  return db.transaction(async (tx) => {
    const quiz = await createEmptyFinalQuiz(tx);

    let courseRows;
    try {
      courseRows = await tx
        .insert(courses)
        .values({
          title: input.title,
          slug: input.slug,
          summary: input.summary,
          level: input.level,
          status: "DRAFT",
          finalQuizId: quiz.id,
          createdBy: actorId,
          updatedBy: actorId,
        })
        // Explicit column list (src/modules/README.md): exactly what
        // CourseDetailRow consumes, never the whole table.
        .returning({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          summary: courses.summary,
          description: courses.description,
          thumbnailUrl: courses.thumbnailUrl,
          level: courses.level,
          status: courses.status,
          estimatedMinutes: courses.estimatedMinutes,
          publishedAt: courses.publishedAt,
          finalQuizId: courses.finalQuizId,
          enrollmentCount: courses.enrollmentCount,
          updatedAt: courses.updatedAt,
        });
    } catch (error) {
      if (isUniqueViolation(error, "courses_slug_unique")) {
        throw courseFieldError("slug", SLUG_TAKEN_MESSAGE(input.slug));
      }
      throw error;
    }
    const course = courseRows[0];
    if (!course) {
      throw new Error("createCourseWithFinalQuiz: insert returned no row");
    }

    const [owner] = await tx
      .select(ownerColumns)
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);

    const dto = toCmsCourseDetailDTO({
      ...course,
      ownerName: owner?.ownerName ?? "",
      ownerEmail: owner?.ownerEmail ?? "",
      finalQuizQuestionCount: 0,
    });

    await tx.insert(auditLogs).values({
      actorId,
      action: "course.create",
      entityType: "course",
      entityId: course.id,
      before: null,
      // The serialized DTO, not the raw row (CMS-12: after = what the API
      // would answer).
      after: dto,
      // Stays null in this card (card S1-01).
      ip: null,
    });

    return dto;
  });
}

// ------------------------------------------------- builder & update (S1-02)

/** Lowercase + collapsed spaces — the similar-title comparison form (21f). */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Is one normalized title a prefix of the other (equal counts too)? */
export function isSimilarTitle(candidate: string, existing: string): boolean {
  return existing.startsWith(candidate) || candidate.startsWith(existing);
}

/** Builder lookup (21a/21g): the settings audience's column set. */
export async function findCourseBuilderById(
  courseId: string,
): Promise<CourseBuilderRow | undefined> {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      summary: courses.summary,
      description: courses.description,
      level: courses.level,
      status: courses.status,
      isSequential: courses.isSequential,
      updatedAt: courses.updatedAt,
      finalQuizId: courses.finalQuizId,
      ...ownerColumns,
      finalQuizQuestionCount: finalQuizQuestionCountSql,
      finalQuizDurationMinutes: finalQuizDurationSql,
    })
    .from(courses)
    .innerJoin(users, eq(courses.createdBy, users.id))
    .where(eq(courses.id, courseId))
    .limit(1);
  return rows[0];
}

export type UpdateCourseResult = {
  dto: ReturnType<typeof toCmsCourseBuilderDTO>;
  /** false = nothing changed: no write, no audit (card §2 step 4). */
  changed: boolean;
};

/**
 * Update the builder settings of a DRAFT course in ONE transaction (card
 * S1-02 §2). Order inside the lock:
 *   1. SELECT … FOR UPDATE (unknown id → 404; status ≠ DRAFT → 409);
 *   2. field errors in FORM order — similar title against OTHER courses
 *      first, then slug taken by OTHER courses (the unique-violation catch
 *      below maps the race to the same slug error);
 *   3. no actual change → current DTO back, no write, no audit;
 *   4. change → update + updated_by + ONE audit row with the before/after
 *      builder DTOs.
 *
 * The similar-title and slug checks only run when that field actually
 * changed: an untouched title is always "similar" to itself under the
 * prefix rule, and that must never block saving the level or summary
 * (review addition 4).
 */
export async function updateCourseIfDraft(input: {
  courseId: string;
  values: UpdateCourseInput;
  actorId: string;
}): Promise<UpdateCourseResult> {
  return db.transaction(async (tx) => {
    const lockedRows = await tx
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        summary: courses.summary,
        description: courses.description,
        level: courses.level,
        status: courses.status,
        isSequential: courses.isSequential,
        updatedAt: courses.updatedAt,
        finalQuizId: courses.finalQuizId,
        ...ownerColumns,
        finalQuizQuestionCount: finalQuizQuestionCountSql,
        finalQuizDurationMinutes: finalQuizDurationSql,
      })
      .from(courses)
      .innerJoin(users, eq(courses.createdBy, users.id))
      .where(eq(courses.id, input.courseId))
      .limit(1)
      // Lock ONLY the courses row: without `of`, FOR UPDATE also locks the
      // joined users row, stalling unrelated inserts that FK to that user
      // (sessions, audit_logs) for the whole transaction.
      .for("update", { of: courses });
    const current = lockedRows[0];
    if (!current) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }
    if (current.status !== "DRAFT") {
      throw new ConflictError(NOT_DRAFT_MESSAGE);
    }

    const values = input.values;
    const titleChanged =
      normalizeTitle(values.title) !== normalizeTitle(current.title);
    if (titleChanged) {
      const similar = (
        await tx
          .select({ id: courses.id, title: courses.title })
          .from(courses)
          .where(ne(courses.id, input.courseId))
      ).find((course) =>
        isSimilarTitle(normalizeTitle(values.title), normalizeTitle(course.title)),
      );
      if (similar) {
        throw courseFieldError("title", SIMILAR_TITLE_MESSAGE(similar.title));
      }
    }

    if (values.slug !== current.slug) {
      const clash = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.slug, values.slug), ne(courses.id, input.courseId)))
        .limit(1);
      if (clash.length > 0) {
        throw courseFieldError("slug", SLUG_TAKEN_MESSAGE(values.slug));
      }
    }

    const before = toCmsCourseBuilderDTO(current);

    const changed =
      values.title !== current.title ||
      values.slug !== current.slug ||
      values.summary !== current.summary ||
      values.level !== current.level ||
      values.isSequential !== current.isSequential;
    if (!changed) {
      return { dto: before, changed: false };
    }

    let updatedRows;
    try {
      updatedRows = await tx
        .update(courses)
        .set({
          title: values.title,
          slug: values.slug,
          summary: values.summary,
          level: values.level,
          isSequential: values.isSequential,
          updatedBy: input.actorId,
        })
        .where(eq(courses.id, input.courseId))
        .returning({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          summary: courses.summary,
          description: courses.description,
          level: courses.level,
          status: courses.status,
          isSequential: courses.isSequential,
          updatedAt: courses.updatedAt,
          finalQuizId: courses.finalQuizId,
        });
    } catch (error) {
      if (isUniqueViolation(error, "courses_slug_unique")) {
        throw courseFieldError("slug", SLUG_TAKEN_MESSAGE(values.slug));
      }
      throw error;
    }
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("updateCourseIfDraft: update returned no row");
    }

    const after = toCmsCourseBuilderDTO({
      ...updated,
      ownerName: current.ownerName,
      ownerEmail: current.ownerEmail,
      finalQuizQuestionCount: current.finalQuizQuestionCount,
      finalQuizDurationMinutes: current.finalQuizDurationMinutes,
    });

    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "course.update",
      entityType: "course",
      entityId: updated.id,
      // Builder DTOs on both sides (review addition 2a) — no TipTap
      // document in the audit trail.
      before,
      after,
      ip: null,
    });

    return { dto: after, changed: true };
  });
}
