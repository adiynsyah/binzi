import { canAccessLesson } from "@/features/progress/queries/canAccessLesson";
import { getLessonQuiz } from "@/features/quizzes/queries/getLessonQuizForEditor";

/**
 * Authoritative Lesson Quiz access check (TASK 048, Task Plan "Quiz
 * Access Service" — "User must: Be authenticated / Have Course access /
 * Have Lesson access"; Blueprint §28 Learning Engine placement,
 * §29 "Do not duplicate this logic across pages"; BR §11 Lesson Quiz
 * Rules; Decisions Log #1 "Guests may NOT ... access Lesson Quiz").
 *
 * Course access, Lesson access, and the BR §9 unlocking rule are NOT
 * re-derived here: this function delegates to the ONE centralized
 * lesson gate canAccessLesson (TASK 044) and passes its denials
 * through verbatim, so a Lesson Quiz is never more reachable than its
 * own lesson. On top of an allowed lesson it resolves the lesson's
 * ONE Lesson Quiz row through the same (lesson_id, type = 'LESSON')
 * resolver the CMS builder uses (TASK 033 getLessonQuiz) — the quiz
 * of another lesson or a course's Final Quiz can never leak into this
 * context. A lesson whose quiz row has not been materialized yet
 * (quizzes are created lazily by the first add-question mutation)
 * denies as QUIZ_NOT_FOUND — fail-closed, never a partial player.
 *
 * Read-only: an access check never writes lesson_progress or
 * quiz_attempts — progress rows are created lazily by the lesson
 * experience and advanced only by the server scoring flow (Decisions
 * Log #12; BR §10/§12). Question-count readiness (exactly 10) is
 * deliberately NOT part of access: it is publish validation (BR §31
 * service-layer rules, TASK 035) and runtime scoring derives
 * correct/total authoritatively. The payload carries only what the
 * quiz player and scoring flow need — identifiers stay server-side,
 * consumers are later milestones (TASK 049+), exactly like 044.
 */

export type LessonQuizAccess =
  | {
      allowed: true;
      course: { slug: string; title: string };
      enrollmentId: string;
      lesson: { slug: string; title: string };
      quiz: { id: string; title: string };
    }
  | {
      allowed: false;
      reason:
        | "UNAUTHENTICATED"
        | "NOT_ENROLLED"
        | "NOT_FOUND"
        | "LESSON_LOCKED"
        | "QUIZ_NOT_FOUND";
    };

export async function canAccessLessonQuiz(
  userId: string | null,
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonQuizAccess> {
  if (userId === null) {
    // Guests may not access Lesson Quizzes (Decisions Log #1).
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  // The ONE lesson gate (Blueprint §29) — Course access, Lesson
  // access, and previous-lesson completion all come from there.
  const access = await canAccessLesson(userId, courseSlug, lessonSlug);
  if (!access.allowed) {
    return access;
  }

  const quiz = await getLessonQuiz(access.lesson.id);
  if (!quiz) {
    return { allowed: false, reason: "QUIZ_NOT_FOUND" };
  }

  return {
    allowed: true,
    course: access.course,
    enrollmentId: access.enrollmentId,
    lesson: { slug: access.lesson.slug, title: access.lesson.title },
    quiz,
  };
}
