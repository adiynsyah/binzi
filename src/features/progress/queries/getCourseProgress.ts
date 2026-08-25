import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, enrollments, lessonProgress, lessons } from "@/db/schema";

/**
 * Authoritative Course progress retrieval (TASK 043, Task Plan "Progress
 * reflects completed Lessons"; Blueprint §33 "Progress should be derived
 * from authoritative records. Do not store redundant progress values.";
 * Business Rules §2.1/§37/§38; Decisions Log #12).
 *
 * Derivation contract — nothing is stored beyond the authoritative
 * records (Blueprint §33):
 * - A lesson is COMPLETED exactly when its lesson_progress row for THIS
 *   enrollment says so (the row itself is advanced by the quiz flow of
 *   later milestones; this query only reads).
 * - Lessons with no row yet are NOT_STARTED — rows are created lazily
 *   when a user opens a lesson (Decisions Log #12), so "no row" is the
 *   normal state of an untouched lesson, not missing data.
 * - Course percent is computed, never persisted:
 *   round(100 * completed / total) — the integer display UI/UX §27
 *   prescribes ("4 of 5 Lessons completed", "80%"); rounding follows the
 *   approved #7 derivation precedent. A course with zero published
 *   lessons reports 0, never a division error.
 *
 * Boundary discipline (all server-side, in the query):
 * - The course must be PUBLISHED (Business Rules §5; the same
 *   drafts-are-indistinguishable contract as getPublishedCourseBySlug —
 *   an unknown slug, a DRAFT course, and a not-enrolled user all return
 *   null; callers that need to distinguish these resolve the course
 *   first with the existing public queries).
 * - The user must be enrolled (BR §2.1 "Course progress is tracked per
 *   enrolled user") — enforced by the INNER JOIN, which also makes
 *   course + enrollment one atomic read.
 * - The lesson list is the LATEST PUBLISHED lesson set of the course,
 *   ordered by sortOrder (BR §38 "User sees latest published state").
 *   Progress rows that reference lessons outside that set are simply
 *   not joined — existing rows are never reset or recalculated here
 *   (BR §21/§38), they just do not surface as current progress.
 *
 * Per-lesson fan-out is structurally impossible:
 * UNIQUE(enrollment_id, lesson_id) on lesson_progress yields at most one
 * row per lesson, and UNIQUE(user_id, course_id) on enrollments yields
 * exactly one enrollment per pair.
 *
 * Consumers (later milestones): the Lesson access service (044), the
 * learning layout (045), and the Lesson Progress UI (047). The payload
 * carries only what those server-side consumers need — identifiers for
 * authorization/progress writes plus display fields; no timestamps, no
 * administrative columns.
 */

export type CourseProgressLesson = {
  id: string;
  title: string;
  sortOrder: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
};

export type CourseProgress = {
  course: { id: string; slug: string; title: string };
  enrollment: { id: string; status: "ACTIVE" | "COMPLETED" };
  lessons: CourseProgressLesson[];
  completedLessonCount: number;
  totalLessonCount: number;
  percent: number;
};

export async function getCourseProgress(
  userId: string,
  slug: string,
): Promise<CourseProgress | null> {
  const contextRows = await db
    .select({
      courseId: courses.id,
      courseSlug: courses.slug,
      courseTitle: courses.title,
      enrollmentId: enrollments.id,
      enrollmentStatus: enrollments.status,
    })
    .from(courses)
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.courseId, courses.id),
        eq(enrollments.userId, userId),
      ),
    )
    .where(and(eq(courses.slug, slug), eq(courses.status, "PUBLISHED")))
    .limit(1);

  const context = contextRows[0];
  if (!context) {
    return null;
  }

  const lessonRows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      sortOrder: lessons.sortOrder,
      progressStatus: lessonProgress.status,
    })
    .from(lessons)
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.enrollmentId, context.enrollmentId),
      ),
    )
    .where(
      and(eq(lessons.courseId, context.courseId), eq(lessons.status, "PUBLISHED")),
    )
    .orderBy(asc(lessons.sortOrder));

  const lessonList: CourseProgressLesson[] = lessonRows.map((row) => ({
    id: row.id,
    title: row.title,
    sortOrder: row.sortOrder,
    status: row.progressStatus ?? "NOT_STARTED",
  }));

  const completedLessonCount = lessonList.filter(
    (lesson) => lesson.status === "COMPLETED",
  ).length;
  const totalLessonCount = lessonList.length;

  return {
    course: {
      id: context.courseId,
      slug: context.courseSlug,
      title: context.courseTitle,
    },
    enrollment: {
      id: context.enrollmentId,
      status: context.enrollmentStatus,
    },
    lessons: lessonList,
    completedLessonCount,
    totalLessonCount,
    percent:
      totalLessonCount === 0
        ? 0
        : Math.round((completedLessonCount / totalLessonCount) * 100),
  };
}
