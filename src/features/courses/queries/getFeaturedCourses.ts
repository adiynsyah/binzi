import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessons } from "@/db/schema";

/**
 * Public featured Courses query (TASK 037, UI/UX §4 "Featured / Popular
 * Courses").
 *
 * Publication is enforced IN THE QUERY, server-side: the only rows this
 * can ever return are `status = 'PUBLISHED'` courses — drafts never
 * reach the public homepage (UI/UX §44 "Draft content must not be
 * indexed", Business Rules §5 public visibility).
 *
 * V1 has no explicit "featured" flag or popularity data, so "featured"
 * resolves to the most recently published Courses — a deterministic,
 * spec-conservative proxy. Ordering: publishedAt DESC, then id DESC as
 * a stable tiebreak (the same convention as listCourses).
 *
 * The lesson count is the PUBLIC count: only PUBLISHED lessons are
 * joined, so draft lesson rows can never influence the public number.
 */
export const FEATURED_COURSES_LIMIT = 3;

export type FeaturedCourse = {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: (typeof courses.$inferSelect)["difficulty"];
  estimatedDuration: number | null;
  lessonCount: number;
};

export async function getFeaturedCourses(
  limit: number = FEATURED_COURSES_LIMIT,
): Promise<FeaturedCourse[]> {
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
    .where(eq(courses.status, "PUBLISHED"))
    .groupBy(courses.id)
    .orderBy(desc(courses.publishedAt), desc(courses.id))
    .limit(limit);

  return rows;
}
