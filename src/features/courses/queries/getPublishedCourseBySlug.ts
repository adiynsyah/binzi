import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, lessons } from "@/db/schema";

/**
 * Public Course Detail query (TASK 039, UI/UX §7 "Course Detail",
 * Business Rules §5, Decisions Log #1).
 *
 * Publication is enforced IN THE QUERY, server-side: the only course
 * this can ever return is `status = 'PUBLISHED'` — a DRAFT course and
 * an unknown slug are both null, so the route renders the same 404 for
 * either and drafts stay indistinguishable from nonexistent courses
 * (UI/UX §44, BR §5, the same contract as getPublishedContentBySlug).
 *
 * Guests may view the full Course Detail (Decisions Log #1), so every
 * field selected here is public catalog data — no administrative
 * fields (createdAt/updatedAt/status) are fetched or exposed.
 *
 * The curriculum list contains ONLY PUBLISHED lessons ordered by
 * sortOrder — the public lesson set, the same convention as the TASK
 * 038 catalog lesson count. Lesson slug/id are not selected: lessons
 * render as non-interactive curriculum rows on this page (the learning
 * experience route belongs to later milestones), so the public payload
 * carries exactly what is rendered.
 */

export type PublishedCourseDetailLesson = {
  id: string;
  title: string;
  description: string | null;
};

export type PublishedCourseDetail = {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: (typeof courses.$inferSelect)["difficulty"];
  estimatedDuration: number | null;
  lessons: PublishedCourseDetailLesson[];
};

export async function getPublishedCourseBySlug(
  slug: string,
): Promise<PublishedCourseDetail | null> {
  const courseRows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      difficulty: courses.difficulty,
      estimatedDuration: courses.estimatedDuration,
    })
    .from(courses)
    .where(and(eq(courses.slug, slug), eq(courses.status, "PUBLISHED")))
    .limit(1);

  const course = courseRows[0];
  if (!course) {
    return null;
  }

  const lessonRows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      description: lessons.description,
    })
    .from(lessons)
    .where(
      and(eq(lessons.courseId, course.id), eq(lessons.status, "PUBLISHED")),
    )
    .orderBy(asc(lessons.sortOrder));

  return {
    ...course,
    lessons: lessonRows,
  };
}
