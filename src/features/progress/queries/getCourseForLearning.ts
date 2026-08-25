import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { lessons } from "@/db/schema";
import { getCourseProgress } from "./getCourseProgress";

/**
 * Authoritative Learning-shell course retrieval (TASK 045, Task Plan
 * "Learning Layout"; Blueprint §16 names getCourseForLearning() as the
 * learning-experience query, §28 "Learning Engine", §36 "Learning Page
 * Implementation — server determines access"; UI/UX §10).
 *
 * Composition, not duplication: the enrollment/publication boundary and
 * every derived progress number come from getCourseProgress (TASK 043 —
 * Blueprint §33 "derive, never store"), which this query simply calls.
 * What TASK 045 adds on top is the one field the 043 payload deliberately
 * omits and the lesson navigation needs: the published lesson SLUGS that
 * form the /courses/[slug]/learn/[lessonSlug] link targets. The extra
 * read is scoped to the course id 043 already resolved server-side, so
 * no client-controlled identifier is ever trusted and the boundary stays
 * exactly as strict (unknown slug, DRAFT course, and a not-enrolled user
 * all return null — UI/UX §44 drafts-indistinguishable).
 *
 * The returned list is the LATEST PUBLISHED lesson set ordered by
 * sortOrder (BR §38). Statuses are the authoritative lesson_progress
 * states read by 043; lessons without a progress row are NOT_STARTED
 * (Decisions Log #12 — rows are created lazily by the lesson
 * experience, never by reads).
 *
 * Read-only: this query never creates or advances lesson_progress, and
 * it never resets existing rows (BR §21/§38). The payload carries only
 * what the learning shell renders — slugs, titles, statuses, and the
 * derived counts; no UUIDs, no timestamps, no administrative columns.
 */

export type LearningLessonNavItem = {
  slug: string;
  title: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
};

export type CourseForLearning = {
  course: { slug: string; title: string };
  lessons: LearningLessonNavItem[];
  completedLessonCount: number;
  totalLessonCount: number;
  percent: number;
};

export async function getCourseForLearning(
  userId: string,
  slug: string,
): Promise<CourseForLearning | null> {
  const progress = await getCourseProgress(userId, slug);
  if (!progress) {
    return null;
  }

  const slugRows = await db
    .select({ id: lessons.id, slug: lessons.slug })
    .from(lessons)
    .where(
      and(eq(lessons.courseId, progress.course.id), eq(lessons.status, "PUBLISHED")),
    )
    .orderBy(asc(lessons.sortOrder));

  const titleById = new Map(progress.lessons.map((lesson) => [lesson.id, lesson.title]));
  const statusById = new Map(progress.lessons.map((lesson) => [lesson.id, lesson.status]));

  const navItems: LearningLessonNavItem[] = slugRows.map((row) => ({
    slug: row.slug,
    title: titleById.get(row.id) ?? "",
    status: statusById.get(row.id) ?? "NOT_STARTED",
  }));

  return {
    course: { slug: progress.course.slug, title: progress.course.title },
    lessons: navItems,
    completedLessonCount: progress.completedLessonCount,
    totalLessonCount: progress.totalLessonCount,
    percent: progress.percent,
  };
}
