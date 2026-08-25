import { z } from "zod";

/**
 * Quiz submission wire contract (TASK 051, Architecture §18 "Validate
 * payload with Zod" at the Server Action boundary; §19 Quiz
 * Anti-Tampering Principle).
 *
 * The client may send ONLY (questionId, selectedOptionId) pairs — on
 * the wire they are the QuizPlayer's radio groups, one `question-{id}`
 * name per question whose value is the selected option id (TASK 049).
 * This module is the ONE translation from FormData entries to the
 * typed pair array TASK 050's scorer accepts:
 *
 * - entries whose key is not `question-…` are never read, so smuggled
 *   `score` / `passed` / `isCorrect` fields cannot even enter the
 *   pipeline (server authority — the scorer recomputes everything);
 * - a duplicated `question-{id}` key (possible only in a forged
 *   multipart body — a real radio group submits one value) is
 *   rejected before zod even runs;
 * - non-string values (a forged file part) are rejected;
 * - the pair array must be non-empty and every id must be a uuid —
 *   full-coverage and membership stay with the scorer (TASK 050),
 *   which knows the quiz's authoritative question set.
 *
 * Client-safe module (no server imports): QuizPlayer types its action
 * prop and initial state from here, mirroring how PublishForm types
 * off publish.schema (TASK 035).
 */

/** One radio group on the wire: the selected option of one question. */
export const quizAnswerPairSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid(),
});

export const quizSubmissionPairsSchema = z
  .array(quizAnswerPairSchema)
  .min(1);

export type QuizAnswerPair = z.infer<typeof quizAnswerPairSchema>;

const QUESTION_KEY_PREFIX = "question-";

/**
 * Extracts and validates the answer pairs from a submitted form.
 * Unknown keys are deliberately unread (documented above); the result
 * is fail-closed: any irregularity denies with { ok: false } and the
 * action answers with a single generic validation message.
 */
export function parseQuizSubmissionForm(formData: FormData):
  | { ok: true; pairs: QuizAnswerPair[] }
  | { ok: false } {
  const pairs: { questionId: string; selectedOptionId: string }[] = [];
  const seenQuestions = new Set<string>();

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(QUESTION_KEY_PREFIX)) {
      // Not part of the answer contract — never read, never trusted.
      continue;
    }
    const questionId = key.slice(QUESTION_KEY_PREFIX.length);
    if (typeof value !== "string" || seenQuestions.has(questionId)) {
      return { ok: false };
    }
    seenQuestions.add(questionId);
    pairs.push({ questionId, selectedOptionId: value });
  }

  const parsed = quizSubmissionPairsSchema.safeParse(pairs);
  return parsed.success ? { ok: true, pairs: parsed.data } : { ok: false };
}

/**
 * Action state for the quiz submission form (TASK 051). The success
 * payload carries ONLY the server-computed verdict Architecture §18
 * names for the "Return result" step — score, passed, and the counts.
 * Per-answer correctness and every internal id stay server-side.
 */
export type QuizSubmitState =
  | { status: "idle" }
  | {
      status: "success";
      score: number;
      passed: boolean;
      correctAnswers: number;
      totalQuestions: number;
    }
  | { status: "error"; message: string };

export const initialQuizSubmitState: QuizSubmitState = { status: "idle" };
