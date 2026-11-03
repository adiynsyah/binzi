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

import { and, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  courses,
  lessons,
  questions,
  users,
} from "@/db/schema";
import { createEmptyFinalQuiz } from "@/modules/quiz/service";

import { isUniqueViolation } from "./db-errors";
import { courseFieldError, SLUG_TAKEN_MESSAGE } from "./errors";
import { toCmsCourseDetailDTO } from "./serializer";
import type { CourseListItemRow, CourseDetailRow } from "./serializer";
import type { ContentStatus, CreateCourseInput } from "./schema";

// Subquery aggregates (no N+1): correlated counts resolved inside the one
// SELECT. mapWith(Number) — drivers hand back bigint counts as strings.
const lessonCountSql = sql<number>`(
  select count(*) from ${lessons} where ${lessons.courseId} = ${courses.id}
)`.mapWith(Number);

const finalQuizQuestionCountSql = sql<number>`(
  select count(*) from ${questions}
  where ${questions.quizId} = ${courses.finalQuizId}
)`.mapWith(Number);

const ownerColumns = {
  ownerName: users.name,
  ownerEmail: users.email,
};

// PG LIKE treats backslash as the escape character by default, so % and _
// typed by the user must be escaped to keep them literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export type CourseStatusCounts = {
  total: number;
  DRAFT: number;
  IN_REVIEW: number;
  PUBLISHED: number;
  ARCHIVED: number;
};

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
        .returning();
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
