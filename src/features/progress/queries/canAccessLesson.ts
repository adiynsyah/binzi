import { and, desc, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { courses, enrollments, lessonProgress, lessons } from "@/db/schema";

/**
 * Authoritative Lesson access check (TASK 044, Task Plan "Lesson 1 →
 * accessible; Lesson N → requires previous Lesson completion; Server-side
 * enforcement required"; Blueprint §29 "Lesson Access Function" —
 * "Do not duplicate this logic across pages"; Business Rules §9 "Lesson
 * Unlocking Rules"/§10 "Lesson Completion Rules"/§38; Decisions Log #1/#12).
 *
 * The ONE centralized gate the learning experience (TASK 045/046) calls
 * before rendering a lesson. It determines, in order, exactly what
 * Blueprint §29 lists:
 *
 *   Authenticated?          → userId null (the caller passes the
 *                             server-resolved session user) denies as
 *                             UNAUTHENTICATED — guests may read the
 *                             Course Detail but never a full Lesson
 *                             (Decisions Log #1).
 *   Course published?       → resolved from the public slug; an unknown
 *                             slug and a DRAFT course are the same
 *                             NOT_FOUND (UI/UX §44 drafts-indistinguishable
 *                             contract of getPublishedCourseBySlug /
 *                             getCourseProgress).
 *   Enrolled?               → NOT_ENROLLED (BR §2.1/§8: learning access
 *                             belongs to enrolled users only).
 *   Lesson exists, published,
 *   in THIS course?         → one slug-scoped lookup: unknown lesson,
 *                             DRAFT lesson, or a slug belonging to another
 *                             course all miss alike → NOT_FOUND (BR §38
 *                             "User sees latest published state").
 *   Previous Lesson
 *   completed?              → BR §9: a user cannot access Lesson N+1
 *                             until Lesson N is completed; the FIRST
 *                             published lesson has no previous lesson and
 *                             is always accessible. "Previous" is the
 *                             adjacent lesson in the published sortOrder
 *                             set (not raw sort_order arithmetic), so the
 *                             rule tracks the latest published state.
 *                             Completion is read from the authoritative
 *                             lesson_progress record (BR §10: a Lesson is
 *                             completed only when its Lesson Quiz is
 *                             passed; Blueprint §33: derive, never store).
 *                             IN_PROGRESS is NOT completion.
 *
 * The result is a discriminated union rather than a bare boolean so
 * callers can answer each denial with the right behavior (login redirect,
 * enroll CTA, 404, locked-lesson state) without re-deriving anything.
 *
 * Read-only: this query never creates or advances lesson_progress —
 * progress rows are created lazily by the lesson experience (Decisions
 * Log #12). Identifiers are resolved server-side from public slugs; no
 * client-controlled entity id or status is trusted. The payload carries
 * only what the lesson renderer needs — no UUID exposure beyond
 * server-side consumers, no timestamps, no administrative columns.
 */

export type LessonAccess =
  | {
      allowed: true;
      course: { slug: string; title: string };
      enrollmentId: string;
      lesson: { id: string; slug: string; title: string; sortOrder: number };
    }
  | {
      allowed: false;
      reason:
        | "UNAUTHENTICATED"
        | "NOT_ENROLLED"
        | "NOT_FOUND"
        | "LESSON_LOCKED";
    };

export async function canAccessLesson(
  userId: string | null,
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonAccess> {
  if (userId === null) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  const courseRows = await db
    .select({ id: courses.id, slug: courses.slug, title: courses.title })
    .from(courses)
    .where(and(eq(courses.slug, courseSlug), eq(courses.status, "PUBLISHED")))
    .limit(1);

  const course = courseRows[0];
  if (!course) {
    // Unknown or DRAFT — indistinguishable by contract (UI/UX §44).
    return { allowed: false, reason: "NOT_FOUND" };
  }

  const enrollmentRows = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, course.id)),
    )
    .limit(1);

  const enrollment = enrollmentRows[0];
  if (!enrollment) {
    return { allowed: false, reason: "NOT_ENROLLED" };
  }

  const lessonRows = await db
    .select({
      id: lessons.id,
      slug: lessons.slug,
      title: lessons.title,
      sortOrder: lessons.sortOrder,
    })
    .from(lessons)
    .where(
      and(
        eq(lessons.courseId, course.id),
        eq(lessons.slug, lessonSlug),
        eq(lessons.status, "PUBLISHED"),
      ),
    )
    .limit(1);

  const lesson = lessonRows[0];
  if (!lesson) {
    // Unknown slug, DRAFT lesson, or a slug of another course —
    // the scoped lookup makes all three indistinguishable.
    return { allowed: false, reason: "NOT_FOUND" };
  }

  // Previous lesson in the published order (BR §9). None → this is the
  // first published lesson → always accessible.
  const previousRows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.courseId, course.id),
        eq(lessons.status, "PUBLISHED"),
        lt(lessons.sortOrder, lesson.sortOrder),
      ),
    )
    .orderBy(desc(lessons.sortOrder))
    .limit(1);

  const previous = previousRows[0];
  if (!previous) {
    return {
      allowed: true,
      course: { slug: course.slug, title: course.title },
      enrollmentId: enrollment.id,
      lesson,
    };
  }

  const previousProgressRows = await db
    .select({ status: lessonProgress.status })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.enrollmentId, enrollment.id),
        eq(lessonProgress.lessonId, previous.id),
      ),
    )
    .limit(1);

  if (previousProgressRows[0]?.status === "COMPLETED") {
    return {
      allowed: true,
      course: { slug: course.slug, title: course.title },
      enrollmentId: enrollment.id,
      lesson,
    };
  }

  return { allowed: false, reason: "LESSON_LOCKED" };
}
