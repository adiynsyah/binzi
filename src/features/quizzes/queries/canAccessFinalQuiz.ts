import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses } from "@/db/schema";
import { getCourseProgress } from "@/features/progress/queries/getCourseProgress";
import { getFinalQuiz } from "@/features/quizzes/queries/getFinalQuizForEditor";

/**
 * Authoritative Final Quiz access check (TASK 048, Task Plan "Quiz
 * Access Service" — "Final Quiz additionally requires all Lessons
 * completed"; Blueprint §30 "Final Quiz Access Function — Rule: All
 * Lessons completed. If not: Forbidden / Locked"; BR §17 Final Quiz
 * Unlock Rules; Architecture §21).
 *
 * The all-lessons-completed derivation is NOT recomputed here: it
 * comes from getCourseProgress (TASK 043) — completedLessonCount vs
 * totalLessonCount over the LATEST PUBLISHED lesson set (BR §38), the
 * same authoritative records every other progress surface reads. A
 * not-yet-finished course denies as FINAL_QUIZ_LOCKED; the check runs
 * BEFORE quiz resolution so an unfinished learner cannot even probe
 * whether the Final Quiz exists.
 *
 * getCourseProgress conflates unknown-slug / DRAFT course /
 * not-enrolled into null (its documented §44 contract), so a denial
 * is disambiguated with one scoped PUBLISHED-course lookup — unknown
 * and DRAFT stay indistinguishable as NOT_FOUND (UI/UX §44), a known
 * published course without an enrollment is NOT_ENROLLED. The Final
 * Quiz row itself is resolved through the same (course_id,
 * type = 'FINAL') resolver the CMS builder uses (TASK 034
 * getFinalQuiz); a course whose Final Quiz row has not been
 * materialized yet denies as QUIZ_NOT_FOUND — fail-closed.
 *
 * Read-only and enrollment-status-agnostic: BR §13/§16 grant
 * unlimited attempts in V1 and nothing forbids re-taking a Final
 * Quiz after enrollment completion, so a COMPLETED enrollment is not
 * a denial here (course completion itself is TASK 057). Question-
 * count readiness (10–30) is publish validation, not access (BR
 * §31, TASK 035). Identifiers stay server-side; consumers are later
 * milestones (TASK 055+), exactly like 044.
 */

export type FinalQuizAccess =
  | {
      allowed: true;
      course: { slug: string; title: string };
      enrollmentId: string;
      quiz: { id: string; title: string };
    }
  | {
      allowed: false;
      reason:
        | "UNAUTHENTICATED"
        | "NOT_ENROLLED"
        | "NOT_FOUND"
        | "FINAL_QUIZ_LOCKED"
        | "QUIZ_NOT_FOUND";
    };

export async function canAccessFinalQuiz(
  userId: string | null,
  courseSlug: string,
): Promise<FinalQuizAccess> {
  if (userId === null) {
    // Guests may not access the Final Quiz (Decisions Log #1).
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  const progress = await getCourseProgress(userId, courseSlug);
  if (progress === null) {
    // Unknown slug, DRAFT course, or not enrolled — one scoped
    // lookup separates NOT_FOUND from NOT_ENROLLED without making
    // unknown and DRAFT distinguishable (UI/UX §44).
    const courseRows = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(eq(courses.slug, courseSlug), eq(courses.status, "PUBLISHED")),
      )
      .limit(1);

    return courseRows.length === 0
      ? { allowed: false, reason: "NOT_FOUND" }
      : { allowed: false, reason: "NOT_ENROLLED" };
  }

  // BR §17 / Blueprint §30: locked until ALL lessons are completed,
  // derived from the authoritative published-set counts (TASK 043).
  if (progress.completedLessonCount !== progress.totalLessonCount) {
    return { allowed: false, reason: "FINAL_QUIZ_LOCKED" };
  }

  const quiz = await getFinalQuiz(progress.course.id);
  if (!quiz) {
    return { allowed: false, reason: "QUIZ_NOT_FOUND" };
  }

  return {
    allowed: true,
    course: { slug: progress.course.slug, title: progress.course.title },
    enrollmentId: progress.enrollment.id,
    quiz,
  };
}
