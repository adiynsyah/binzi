// The ONLY public door of the quiz module (cards S1-01, S1-02). Cross-module
// helpers live here instead of raw inserts inside other modules so the
// quizzes column knowledge keeps one home (module-boundary rule:
// communication via service.ts, never queries.ts).
import {
  MIN_QUESTIONS_KEY,
  insertEmptyFinalQuiz,
  insertEmptyLessonQuiz,
  selectMinQuestionsText,
  type DbTx,
} from "./queries";

export type { DbTx };

/** Create the course's empty FINAL quiz inside the caller's transaction. */
export async function createEmptyFinalQuiz(tx: DbTx): Promise<{ id: string }> {
  return insertEmptyFinalQuiz(tx);
}

/**
 * Create a lesson's empty LESSON quiz inside the caller's transaction
 * (card S1-02 §1): 10 minutes / 70% / one attempt / explanations always,
 * titled after the lesson at creation time.
 */
export async function createEmptyLessonQuiz(
  tx: DbTx,
  input: { title: string },
): Promise<{ id: string }> {
  return insertEmptyLessonQuiz(tx, input);
}

/**
 * The publish-time minimum question count from system_settings
 * (quiz.min_questions, QZ-02). FAIL-CLOSED (card S1-02 rev. point 5): a
 * missing row or an invalid value (non-integer, < 1, wrong JSON type) is a
 * 500 naming the key and the seed command — never a silent fallback number
 * that would let an underfilled quiz look publishable.
 */
export async function getMinQuestions(): Promise<number> {
  const text = await selectMinQuestionsText();
  let value: unknown;
  if (text !== undefined) {
    try {
      value = JSON.parse(text);
    } catch {
      value = text; // not even valid JSON — certainly invalid
    }
  }
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1
  ) {
    return value;
  }
  throw new Error(
    `System setting "${MIN_QUESTIONS_KEY}" is missing or invalid ` +
      `(got ${JSON.stringify(value) ?? "undefined"}). ` +
      `Run "npm run db:seed" to insert it.`,
  );
}
