import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { questionOptions, questions, quizQuestions, quizzes } from "@/db/schema";
import { QUIZ_PASSING_SCORE } from "@/features/quizzes/services/quiz.service";

/**
 * BINZI server-side quiz scoring (TASK 050, Task Plan "Server Quiz
 * Scoring" — "Calculate score server-side"; Critical Rule "Never
 * trust: client score / client passed"; Architecture §18 Quiz
 * Submission "Calculate score on server", §19 Quiz Anti-Tampering
 * Principle; BR §12 attempt rules steps 3–5, §20 Score Calculation;
 * Decisions Log §10 "Quiz Score Storage" — correct_answers +
 * total_questions are the source of truth, percentage derived,
 * passing determined from authoritative values).
 *
 * This service is the ONE authoritative scorer. It accepts ONLY the
 * Architecture §19-allowed client payload — (questionId,
 * selectedOptionId) pairs — and computes every derived value itself:
 *
 * - isCorrect   — read from the authoritative question_options row
 *   (is_correct never enters this function from outside);
 * - score       — round(100 * correct / total)   (approved #7, the
 *   same formula the quiz_attempts_score_derived_check enforces);
 * - passed      — correct * 100 >= QUIZ_PASSING_SCORE * total, the
 *   exact integer comparison immune to rounding      (approved #8,
 *   the same formula as quiz_attempts_passed_derived_check).
 * QUIZ_PASSING_SCORE = 80 is the BR §19 central constant, already
 * centralized in quiz.service.ts (TASK 035).
 *
 * Validation is fail-closed BEFORE any score exists (BR §12 step 4
 * "validates submitted Question/Option relationships"): the
 * submission must answer EVERY question of the quiz exactly once,
 * every questionId must belong to THIS quiz, and every
 * selectedOptionId must be an option of ITS OWN question — a
 * cross-question option id is rejected as tampered, never scored
 * (Architecture §19). Any violation denies as INVALID_SUBMISSION
 * with NO partial result; an unknown quiz denies as INVALID_QUIZ; a
 * quiz with zero questions denies as EMPTY_QUIZ (a 0/0 score is
 * undefined and the quiz_attempts CHECK total_questions > 0 would
 * reject it anyway).
 *
 * Read-only: scoring writes nothing — the attempt/answer persistence
 * transaction is TASK 051, lesson completion TASK 052, retry
 * semantics TASK 053. The quiz id is resolved server-side by the
 * caller through the TASK 048 access services (canAccessLessonQuiz /
 * canAccessFinalQuiz), exactly like getQuizForPlayer (TASK 049); it
 * must never come from client input. The returned per-answer
 * isCorrect values are the quiz_answers snapshot TASK 051 will
 * persist (approved decision #24) — this service renders nothing.
 */
export type QuizAnswerSubmission = {
  questionId: string;
  selectedOptionId: string;
};

export type ScoredQuizAnswer = {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
};

export type QuizScore = {
  correctAnswers: number;
  totalQuestions: number;
  /** round(100 * correctAnswers / totalQuestions) — display + stored. */
  score: number;
  /** Exact integer comparison against QUIZ_PASSING_SCORE. */
  passed: boolean;
  /** Per-question snapshot in the quiz's persisted question order. */
  answers: ScoredQuizAnswer[];
};

export type QuizScoreResult =
  | { ok: true; score: QuizScore }
  | {
      ok: false;
      reason: "INVALID_QUIZ" | "EMPTY_QUIZ" | "INVALID_SUBMISSION";
    };

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function scoreQuizSubmission(
  quizId: string,
  submission: QuizAnswerSubmission[],
): Promise<QuizScoreResult> {
  // Fail-closed on a malformed quiz id before touching the database.
  if (!UUID_PATTERN.test(quizId)) {
    return { ok: false, reason: "INVALID_QUIZ" };
  }

  const quizRows = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (quizRows.length === 0) {
    return { ok: false, reason: "INVALID_QUIZ" };
  }

  // Authoritative question set, persisted order (TASK 031/033
  // ordering discipline; UNIQUE(quiz_id, question_id) means the
  // membership itself has no duplicates).
  const questionRows = await db
    .select({
      questionId: quizQuestions.questionId,
    })
    .from(quizQuestions)
    .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.sortOrder));

  if (questionRows.length === 0) {
    return { ok: false, reason: "EMPTY_QUIZ" };
  }

  // Shape-level rejection before any option lookup: the submission
  // must be a well-formed array of uuid pairs covering every
  // question exactly once, with no duplicate questionId.
  const isValidShape =
    Array.isArray(submission) &&
    submission.length === questionRows.length &&
    submission.every(
      (answer) =>
        typeof answer?.questionId === "string" &&
        typeof answer?.selectedOptionId === "string" &&
        UUID_PATTERN.test(answer.questionId) &&
        UUID_PATTERN.test(answer.selectedOptionId),
    ) &&
    new Set(submission.map((answer) => answer.questionId)).size ===
      submission.length;

  if (!isValidShape) {
    return { ok: false, reason: "INVALID_SUBMISSION" };
  }

  // Authoritative options of THIS quiz's questions — the only ids a
  // legitimate submission can carry. is_correct is read here,
  // server-side, and never leaves through the inputs.
  const optionRows = await db
    .select({
      questionId: questionOptions.questionId,
      optionId: questionOptions.id,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .where(
      inArray(
        questionOptions.questionId,
        questionRows.map((row) => row.questionId),
      ),
    );

  const optionIdsByQuestion = new Map<string, Set<string>>();
  const correctFlagsByOption = new Map<string, boolean>();
  for (const row of optionRows) {
    const ids = optionIdsByQuestion.get(row.questionId) ?? new Set<string>();
    ids.add(row.optionId);
    optionIdsByQuestion.set(row.questionId, ids);
    correctFlagsByOption.set(row.optionId, row.isCorrect);
  }

  // Membership validation (BR §12 step 4): every questionId must be
  // this quiz's, every selectedOptionId must belong to ITS question.
  const submittedByQuestion = new Map<string, string>();
  for (const answer of submission) {
    const optionIds = optionIdsByQuestion.get(answer.questionId);
    if (optionIds === undefined || !optionIds.has(answer.selectedOptionId)) {
      return { ok: false, reason: "INVALID_SUBMISSION" };
    }
    submittedByQuestion.set(answer.questionId, answer.selectedOptionId);
  }

  // Score derivation, in persisted question order. The exactly-one-
  // correct invariant is guaranteed upstream (TASK 031 service
  // writes, TASK 035 publish gate), so the selected option's own
  // is_correct flag IS the per-question verdict.
  const scoredAnswers: ScoredQuizAnswer[] = questionRows.map((row) => {
    const selectedOptionId = submittedByQuestion.get(row.questionId) as string;
    return {
      questionId: row.questionId,
      selectedOptionId,
      isCorrect: correctFlagsByOption.get(selectedOptionId) ?? false,
    };
  });

  const correctAnswers = scoredAnswers.filter((a) => a.isCorrect).length;
  const totalQuestions = questionRows.length;

  return {
    ok: true,
    score: {
      correctAnswers,
      totalQuestions,
      score: Math.round((100 * correctAnswers) / totalQuestions),
      passed: correctAnswers * 100 >= QUIZ_PASSING_SCORE * totalQuestions,
      answers: scoredAnswers,
    },
  };
}
