import { and, count, countDistinct, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { questionOptions, questions, quizQuestions } from "@/db/schema";

import type { QuestionListQuery } from "../schemas/question-list.schema";

/**
 * Question Bank List query (TASK 030, CMS Spec §22, Drizzle Spec
 * §11/§13).
 *
 * Server-side data access through the single existing Drizzle client
 * (server-only via @/db). Search filters question_text with ILIKE
 * (CMS §22 "Search" — the question text is the bank's identifying
 * text). All values are bound parameters — no string-concatenated
 * SQL, no raw SQL surface.
 *
 * Columns per CMS §22: Question, Number of options, Used in,
 * Updated At (Actions is rendered by the page, not fetched).
 * "Number of options" counts question_options rows; "Used in"
 * counts quiz_questions rows (a Question may be reused across many
 * Quizzes — CMS §23 — so the count is not bounded by 1).
 *
 * Join shape: BOTH left joins fan out against each other (4 options
 * × 3 quiz uses = 12 rows), so plain count() would inflate both
 * aggregates. count(DISTINCT id) keeps each exact: option and
 * quiz-question ids are UUID primary keys, so distinct counts are
 * precise. Questions with no options (created outside the CMS) or
 * no quiz use still appear, with 0 counts.
 *
 * Deterministic ordering: updatedAt DESC, then id DESC as a stable
 * tiebreak, so pages never shuffle between requests (TASK 016
 * convention). Read-only — this query never writes.
 */

/** Fixed page size keeps the list bounded as the bank grows. */
export const QUESTION_LIST_PAGE_SIZE = 10;

export type QuestionListItem = {
  id: string;
  questionText: string;
  optionCount: number;
  usedInCount: number;
  updatedAt: Date;
};

export type QuestionListResult = {
  rows: QuestionListItem[];
  total: number;
  page: number;
  pageCount: number;
};

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listQuestions(
  query: QuestionListQuery,
): Promise<QuestionListResult> {
  const conditions = [];

  if (query.q) {
    conditions.push(ilike(questions.questionText, `%${escapeLike(query.q)}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await db
    .select({ value: count() })
    .from(questions)
    .where(where);
  const total = totalRows[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / QUESTION_LIST_PAGE_SIZE));

  // Out-of-range pages clamp to the last existing page.
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const offset = (page - 1) * QUESTION_LIST_PAGE_SIZE;

  const rows = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      updatedAt: questions.updatedAt,
      optionCount: countDistinct(questionOptions.id),
      usedInCount: countDistinct(quizQuestions.id),
    })
    .from(questions)
    .leftJoin(questionOptions, eq(questionOptions.questionId, questions.id))
    .leftJoin(quizQuestions, eq(quizQuestions.questionId, questions.id))
    .where(where)
    .groupBy(questions.id)
    .orderBy(desc(questions.updatedAt), desc(questions.id))
    .limit(QUESTION_LIST_PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount };
}
