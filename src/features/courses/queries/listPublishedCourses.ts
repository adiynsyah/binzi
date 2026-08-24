import { and, count, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessons } from "@/db/schema";

import type { PublicCourseSearchQuery } from "../schemas/public-course-search.schema";

/**
 * Public Course Catalog query (TASK 038, UI/UX §6, BR §5 "Browse Course
 * information" for guests).
 *
 * Publication is enforced IN THE QUERY, server-side: the only rows this
 * can ever return are `status = 'PUBLISHED'` courses — DRAFT courses
 * never reach the public catalog (UI/UX §44, BR §5). Search matches the
 * course title with ILIKE using a bound parameter and escaped LIKE
 * wildcards, the same convention as every existing search query
 * (listCourses, listContents, listQuestions).
 *
 * The lesson count is the PUBLIC count: only PUBLISHED lessons are
 * joined, so draft lesson rows can never influence the public number.
 *
 * Ordering follows the repository convention for public course lists
 * (TASK 037 getFeaturedCourses / CMS listCourses): publishedAt DESC,
 * then id DESC as a stable tiebreak. TASK 038 defines no pagination —
 * V1 scale keeps the full result set bounded.
 */

export type PublishedCourseListItem = {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: (typeof courses.$inferSelect)["difficulty"];
  estimatedDuration: number | null;
  lessonCount: number;
};

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listPublishedCourses(
  query: PublicCourseSearchQuery = {},
): Promise<PublishedCourseListItem[]> {
  const conditions = [eq(courses.status, "PUBLISHED")];

  if (query.q) {
    conditions.push(ilike(courses.title, `%${escapeLike(query.q)}%`));
  }

  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      difficulty: courses.difficulty,
      estimatedDuration: courses.estimatedDuration,
      lessonCount: count(lessons.id),
    })
    .from(courses)
    .leftJoin(
      lessons,
      and(eq(lessons.courseId, courses.id), eq(lessons.status, "PUBLISHED")),
    )
    .where(and(...conditions))
    .groupBy(courses.id)
    .orderBy(desc(courses.publishedAt), desc(courses.id));

  return rows;
}
