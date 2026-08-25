import { db } from "@/db";
import { quizAnswers, quizAttempts } from "@/db/schema";
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
 * Unlimited attempts (BR §13 / approved #23): there is deliberately
 * NO uniqueness on (user_id, quiz_id) — every accepted submission is
 * a NEW attempt row, and a later failed attempt never touches an
 * earlier one. This service also writes NOTHING to lesson_progress:
 * completion-on-pass is TASK 052 (Decisions Log #12 — progress rows
 * are advanced only by the completion flow).
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

    return { attemptId: attempt.id };
  });
}
