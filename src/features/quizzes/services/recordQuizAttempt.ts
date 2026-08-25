import { eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { lessonProgress, quizAnswers, quizAttempts, quizzes } from "@/db/schema";
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
 */
export async function recordQuizAttempt(
  userId: string,
  quizId: string,
  score: QuizScore,
  completion?: { enrollmentId: string },
): Promise<{ attemptId: string }> {
  return db.transaction(async (tx) => {
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
      }
    }

    return { attemptId: attempt.id };
  });
}
