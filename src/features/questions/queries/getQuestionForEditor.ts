import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { questionOptions, questions, quizQuestions } from "@/db/schema";

import type { EditableQuestion } from "../schemas/question-form.schema";

/**
 * Question editor query (TASK 031, CMS §22/§24).
 *
 * Loads one bank Question with its options in the persisted
 * sort_order (the order the editor form re-submits as its row
 * order) plus the CMS §24 reuse count ("used in N quizzes") the
 * edit page renders as the editing warning.
 *
 * Server-side only (via @/db). Read-only. Malformed ids return
 * null instead of throwing so the page can render a plain 404
 * (TASK 019 convention).
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getQuestionForEditor(
  questionId: string,
): Promise<EditableQuestion | null> {
  if (!UUID_PATTERN.test(questionId)) {
    return null;
  }

  const [question] = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      explanation: questions.explanation,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) {
    return null;
  }

  const options = await db
    .select({
      optionId: questionOptions.id,
      optionText: questionOptions.optionText,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .where(eq(questionOptions.questionId, questionId))
    .orderBy(asc(questionOptions.sortOrder));

  const [usage] = await db
    .select({ value: count() })
    .from(quizQuestions)
    .where(eq(quizQuestions.questionId, questionId));

  return {
    id: question.id,
    questionText: question.questionText,
    explanation: question.explanation,
    options,
    usedInCount: usage?.value ?? 0,
  };
}
