// The ONLY public door of the quiz module (cards S1-01, S1-02). Cross-module
// helpers live here instead of raw inserts inside other modules so the
// quizzes column knowledge keeps one home (module-boundary rule:
// communication via service.ts, never queries.ts).
import {
  FINAL_WEIGHT_KEY,
  LESSON_WEIGHT_KEY,
  MIN_QUESTIONS_KEY,
  createQuestionTx,
  insertEmptyFinalQuiz,
  insertEmptyLessonQuiz,
  selectMinQuestionsText,
  selectScoreWeightTexts,
  updateQuestionTx,
  type DbTx,
} from "./queries";
import { assertCanManageQuizzes, type Actor } from "./policy";
import { getQuizInput, questionInput } from "./schema";
import {
  toQuizEditorDTO,
  type QuestionSummaryDTO,
  type QuizEditorDTO,
  type ScoreWeights,
} from "./serializer";
import * as quizQueries from "./queries";
import { NotFoundError } from "@/lib/errors";

export type { DbTx };
export type { Actor };
export type {
  QuestionSummaryDTO,
  QuizEditorDTO,
  QuizEditorQuestionDTO,
  ScoreWeights,
} from "./serializer";

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

/**
 * The score split from system_settings (score.lesson_weight /
 * score.final_weight, card S1-09 §3 — the results card Sen 16 reuses
 * this). FAIL-CLOSED exactly like getMinQuestions: a missing row, a
 * non-integer, a value outside 0–100, or a sum ≠ 100 is a 500 naming BOTH
 * keys and the seed command — never a silent 60/40 fallback that would
 * mislabel every report.
 */
export async function getScoreWeights(): Promise<ScoreWeights> {
  const texts = await selectScoreWeightTexts();

  function parse(text: string | undefined): number | null {
    if (text === undefined) return null;
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = text; // not even valid JSON — certainly invalid
    }
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 100
    ) {
      return value;
    }
    return null;
  }

  const lessonPercent = parse(texts.lessonWeightText);
  const finalPercent = parse(texts.finalWeightText);
  if (
    lessonPercent === null ||
    finalPercent === null ||
    lessonPercent + finalPercent !== 100
  ) {
    // The RAW ::text values go into the message — never re-parsed here.
    const show = (value: number | null, text: string | undefined): string =>
      value !== null ? String(value) : (text ?? "undefined");
    throw new Error(
      `System settings "${LESSON_WEIGHT_KEY}" and "${FINAL_WEIGHT_KEY}" are missing or invalid ` +
        `(got ${show(lessonPercent, texts.lessonWeightText)} / ${show(finalPercent, texts.finalWeightText)}; ` +
        `they must be integers 0–100 summing to 100). ` +
        `Run "npm run db:seed" to insert them.`,
    );
  }
  return { lessonPercent, finalPercent };
}

// ------------------------------------------------- question save (card S1-09)

/**
 * "＋ Tambah soal" / create (card §2). Role FIRST, input parsing after —
 * an unauthorized caller never learns the input contract. The transaction
 * enforces the owner + DRAFT gates (404 / 409) after the row lock.
 */
export async function createQuestion(
  actor: Actor,
  ids: { quizId: string },
  input: unknown,
): Promise<QuestionSummaryDTO> {
  assertCanManageQuizzes(actor);
  const values = questionInput.parse(input);
  return createQuestionTx({
    quizId: ids.quizId,
    values,
    actorId: actor.id,
  });
}

/**
 * "Sunting soal nn" / update (card §2). Same guard order; a question that
 * does not exist OR belongs to another quiz is a 404 (anti-IDOR).
 */
export async function updateQuestion(
  actor: Actor,
  ids: { quizId: string; questionId: string },
  input: unknown,
): Promise<QuestionSummaryDTO> {
  assertCanManageQuizzes(actor);
  const values = questionInput.parse(input);
  return updateQuestionTx({
    quizId: ids.quizId,
    questionId: ids.questionId,
    values,
    actorId: actor.id,
  });
}

/**
 * The /cms/quiz/{quizId} page's data (card §3): EDITOR+; a quiz without an
 * owning course → 404. Question key + explanation ride along DELIBERATELY
 * (staff page) — the participant path (Sab 14) must not reuse this DTO.
 */
export async function getQuizEditor(
  actor: Actor,
  input: unknown,
): Promise<QuizEditorDTO> {
  assertCanManageQuizzes(actor);
  const { quizId } = getQuizInput.parse(input);

  const lookup = await quizQueries.findQuizEditorById(quizId);
  if (!lookup) {
    throw new NotFoundError("Quiz tidak ditemukan");
  }
  const [minQuestions, weights] = await Promise.all([
    getMinQuestions(),
    getScoreWeights(),
  ]);
  return toQuizEditorDTO({ ...lookup, minQuestions, weights });
}
