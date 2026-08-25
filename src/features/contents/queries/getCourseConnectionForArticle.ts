import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessonContents, lessons } from "@/db/schema";

/**
 * Article → Course connection query (TASK 041, UI/UX §29
 * "Article → Course Connection"; Business Rules §4.2 "An Article
 * Content item can be … Used as material inside a Course Lesson").
 *
 * §29 is explicitly OPTIONAL for the public article ("may
 * optionally include") and applies only "If an Article is also
 * used as Course material" — the grounded condition is a
 * lesson_contents row referencing the content
 * (UNIQUE(content_id), decision #3: at most one Lesson, and a
 * Lesson belongs to exactly one Course, so at most one course
 * connection can exist).
 *
 * The connection is surfaced ONLY when the owning course is
 * PUBLISHED (`courses.status = 'PUBLISHED'` in the WHERE clause,
 * server-side): linking a guest to a DRAFT course detail would 404
 * (getPublishedCourseBySlug), so a draft course renders no band at
 * all — the same publication-boundary discipline as every public
 * query. Only the course title + slug are selected; no admin
 * metadata leaves the query.
 */
export type ArticleCourseConnection = {
  title: string;
  slug: string;
};

export async function getCourseConnectionForArticle(
  contentId: string,
): Promise<ArticleCourseConnection | null> {
  const rows = await db
    .select({ title: courses.title, slug: courses.slug })
    .from(lessonContents)
    .innerJoin(lessons, eq(lessonContents.lessonId, lessons.id))
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(
      and(
        eq(lessonContents.contentId, contentId),
        eq(courses.status, "PUBLISHED"),
      ),
    )
    .limit(1);

  // At most one row can exist (UNIQUE(content_id) → one Lesson →
  // one Course).
  return rows[0] ?? null;
}
