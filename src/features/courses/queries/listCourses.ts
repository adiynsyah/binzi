import { and, count, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessons } from "@/db/schema";

import type { CourseListQuery } from "../schemas/course-list.schema";

/**
 * Course List query (TASK 022, CMS Spec §5, Drizzle Spec §6).
 *
 * Server-side data access through the single existing Drizzle
 * client (server-only via @/db). Search filters the title with
 * ILIKE (CMS §5 "Optional search by title") and the status filter
 * uses the shared publication_status enum column. All values are
 * bound parameters — no string-concatenated SQL.
 *
 * "Number of Lessons" counts lessons rows per Course (CMS §5),
 * the same leftJoin + groupBy shape as the TASK 016 "Used In"
 * count.
 *
 * Deterministic ordering: updatedAt DESC, then id DESC as a
 * stable tiebreak, so pages never shuffle between requests.
 */

/** Fixed page size keeps the list bounded as the CMS grows. */
export const COURSE_LIST_PAGE_SIZE = 10;

export type CourseListItem = {
  id: string;
  title: string;
  status: (typeof courses.$inferSelect)["status"];
  difficulty: (typeof courses.$inferSelect)["difficulty"];
  estimatedDuration: number | null;
  updatedAt: Date;
  lessonCount: number;
};

export type CourseListResult = {
  rows: CourseListItem[];
  total: number;
  page: number;
  pageCount: number;
};

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listCourses(
  query: CourseListQuery,
): Promise<CourseListResult> {
  const conditions = [];

  if (query.q) {
    conditions.push(ilike(courses.title, `%${escapeLike(query.q)}%`));
  }
  if (query.status) {
    conditions.push(eq(courses.status, query.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await db
    .select({ value: count() })
    .from(courses)
    .where(where);
  const total = totalRows[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / COURSE_LIST_PAGE_SIZE));

  // Out-of-range pages clamp to the last existing page.
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const offset = (page - 1) * COURSE_LIST_PAGE_SIZE;

  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      difficulty: courses.difficulty,
      estimatedDuration: courses.estimatedDuration,
      updatedAt: courses.updatedAt,
      lessonCount: count(lessons.id),
    })
    .from(courses)
    .leftJoin(lessons, eq(lessons.courseId, courses.id))
    .where(where)
    .groupBy(courses.id)
    .orderBy(desc(courses.updatedAt), desc(courses.id))
    .limit(COURSE_LIST_PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount };
}
