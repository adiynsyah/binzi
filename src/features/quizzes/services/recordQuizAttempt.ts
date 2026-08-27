import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  enrollments,
  lessonProgress,
  quizAnswers,
  quizAttempts,
  quizzes,
} from "@/db/schema";
import type { QuizScore } from "@/features/quizzes/services/scoreQuizSubmission";

/**
 * Quiz attempt persistence (TASK 051, Task Plan "Store Quiz Attempt —
 * Persist: Quiz Attempt / Quiz Answers / Score / Passed. Use a
 * transaction"; Blueprint §31 "Quiz Submission Steps: Create attempt
 * → Create answers", §32 "Quiz Transaction — quiz_attempt +
 * quiz_answers … must not leave partially recorded attempts"; BR §12
 * steps 6–7).
 *
 * One atomic database transaction writes the attempt row and its
 * complete answer snapshot from the TASK 050 scoring result — the
 * values the quiz_attempts derived CHECK constraints already encode:
 *
 * - score  = round(100 * correct / total)      (approved #7);
 * - passed = correct * 100 >= 80 * total        (approved #8);
 * - each quiz_answers.is_correct is the frozen server-computed
 *   verdict (approved decision #24 — never recomputed later).
 *
 * startedAt/completedAt are both the submission timestamp: V1 tracks
 * no earlier authoritative "start" (the player holds answering state
 * client-side only), and scoring is immediate at submission.
 *
 * TASK 052 extends the SAME transaction with lesson completion
 * (Task Plan 052 "Complete Lesson when Quiz passes … score >= 80%":
 * BR §12 step 8 "If score >= 80%, the Lesson is completed";
 * Blueprint §31 "If passed: update lesson progress", §32 lists
 * lesson completion among the quiz-transaction writes). When the
 * caller supplies the enrollment resolved by canAccessLessonQuiz and
 * the authoritative result is `passed`, the lesson's progress row is
 * upserted to COMPLETED — keyed by the schema's
 * UNIQUE(enrollment_id, lesson_id), so repeated passes never create
 * duplicates, and the DO UPDATE is guarded by status <> 'COMPLETED'
 * (approved #21 no-downgrade): an already-completed lesson keeps its
 * original completed_at untouched. Failed submissions simply never
 * reach that branch — a fail writes NO progress state. The lesson id
 * is derived from the quiz row itself inside the transaction; a quiz
 * without a lesson (the FINAL quiz) is not a lesson completion and
 * is skipped — course completion is not this task.
 *
 * Unlimited attempts (BR §13 / approved #23): there is deliberately
 * NO uniqueness on (user_id, quiz_id) — every accepted submission is
 * a NEW attempt row, and a later failed attempt never touches an
 * earlier one or a completed lesson.
 *
 * The userId and quizId arrive server-resolved (the action
 * authenticated the caller and resolved the quiz through
 * canAccessLessonQuiz, TASK 048); the score is the TASK 050 result —
 * this service never recomputes or trusts any client-provided value.
 *
 * TASK 057 extends the SAME transaction with course completion
 * (Task Plan 057 "Complete enrollment — All Lessons completed + Final
 * Quiz passed → enrollment.status = COMPLETED, completed_at =
 * timestamp"; BR §18; Blueprint §32 lists course completion among the
 * quiz-transaction writes). The branch is keyed on the quiz's own row
 * exactly like 052: a quiz WITH lesson_id completes its lesson, a
 * quiz WITHOUT one (the FINAL quiz) completes the enrollment. The
 * write is a guarded UPDATE — only an ACTIVE enrollment advances to
 * COMPLETED, so a repeated pass never overwrites the original
 * completed_at and a later failed attempt (which never reaches this
 * branch) can never downgrade one — the same no-downgrade discipline
 * as lesson completion. status and completed_at move together in the
 * one statement (enrollments_status_completed_at_check). The
 * all-lessons-completed half of BR §18 was derived by
 * canAccessFinalQuiz earlier in the same request (Blueprint §30) over
 * the authoritative published set — never from client input. The
 * returned courseCompleted flag is the server-determined verdict
 * BR §30 names; it is undefined/false for every lesson-quiz call.
 */
export async function recordQuizAttempt(
  userId: string,
  quizId: string,
  score: QuizScore,
  completion?: { enrollmentId: string },
): Promise<{ attemptId: string; courseCompleted: boolean }> {
  let courseCompleted = false;

  const { attemptId } = await db.transaction(async (tx) => {
    const now = new Date();

    const attemptRows = await tx
      .insert(quizAttempts)
      .values({
        userId,
        quizId,
        correctAnswers: score.correctAnswers,
        totalQuestions: score.totalQuestions,
        score: score.score,
        passed: score.passed,
        startedAt: now,
        completedAt: now,
      })
      .returning({ id: quizAttempts.id });

    const attempt = attemptRows[0];

    const answerRows = await tx
      .insert(quizAnswers)
      .values(
        score.answers.map((answer) => ({
          attemptId: attempt.id,
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId,
          isCorrect: answer.isCorrect,
        })),
      )
      .returning({ id: quizAnswers.id });

    // Post-verification inside the transaction: the snapshot must be
    // complete. Any short count — or any constraint violation on the
    // inserts above — throws and rolls the whole transaction back,
    // leaving neither the attempt nor a partial answer set behind.
    if (answerRows.length !== score.totalQuestions) {
      throw new Error(
        `recordQuizAttempt post-verify failed: ${answerRows.length}/${score.totalQuestions} answers persisted`,
      );
    }

    // TASK 052 — completion-on-pass, still inside the one transaction
    // (Blueprint §31/§32). Only an authoritative `passed` result and
    // a server-resolved enrollment can reach the write; the lesson
    // comes from the quiz's own row, never from client input.
    if (completion && score.passed) {
      const quizRows = await tx
        .select({ lessonId: quizzes.lessonId })
        .from(quizzes)
        .where(eq(quizzes.id, quizId))
        .limit(1);

      const lessonId = quizRows[0]?.lessonId;
      if (lessonId !== null && lessonId !== undefined) {
        await tx
          .insert(lessonProgress)
          .values({
            enrollmentId: completion.enrollmentId,
            lessonId,
            status: "COMPLETED",
            startedAt: now,
            completedAt: now,
          })
          .onConflictDoUpdate({
            target: [lessonProgress.enrollmentId, lessonProgress.lessonId],
            set: { status: "COMPLETED", completedAt: now },
            // Approved #21: status only ever advances — an existing
            // COMPLETED row is left exactly as it was (idempotent;
            // the original completed_at is preserved).
            setWhere: ne(lessonProgress.status, "COMPLETED"),
          });
      } else {
        // TASK 057 — course completion for the FINAL quiz (lesson_id
        // is NULL), still inside the one transaction (Blueprint §32).
        // The guarded UPDATE is the whole idempotency story: only an
        // ACTIVE row matches, so a repeat pass writes nothing and the
        // original completed_at survives untouched.
        const completedRows = await tx
          .update(enrollments)
          .set({ status: "COMPLETED", completedAt: now })
          .where(
            and(
              eq(enrollments.id, completion.enrollmentId),
              eq(enrollments.status, "ACTIVE"),
            ),
          )
          .returning({ id: enrollments.id });

        if (completedRows.length > 0) {
          courseCompleted = true;
        } else {
          // No row advanced: either the enrollment is already
          // COMPLETED (report true — the course IS completed) or the
          // id is gone (treat as not completed; fail-neutral).
          const statusRows = await tx
            .select({ status: enrollments.status })
            .from(enrollments)
            .where(eq(enrollments.id, completion.enrollmentId))
            .limit(1);
          courseCompleted = statusRows[0]?.status === "COMPLETED";
        }
      }
    }

    return { attemptId: attempt.id };
  });

  return { attemptId, courseCompleted };
}
