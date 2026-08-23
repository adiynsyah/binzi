import { count, countDistinct, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/db";
import { questionOptions, questions, quizQuestions } from "@/db/schema";
import { QUESTION_LIST_PAGE_SIZE } from "@/features/questions/queries/listQuestions";

import type { LessonQuizSearchQuery } from "../schemas/lesson-quiz-search.schema";

/**
 * Lesson Quiz builder candidate search (TASK 033, CMS Spec §21/§23).
 *
 * Server-side question-text search over the WHOLE Question Bank
 * (the TASK 030 conventions: ILIKE with escaped wildcards, bound
 * parameters only, fixed page size, deterministic ordering updatedAt
 * DESC then id DESC).
 *
 * Reusability (CMS §23 — the deliberate contrast with §11 Content
 * reuse): a Question MAY sit in many Quizzes, so — unlike the TASK 028
 * content picker — being used elsewhere NEVER disables a candidate.
 * The ONLY unselectable state is "already in THIS quiz"
 * (UNIQUE(quiz_id, question_id)); the UI renders it as a disabled
 * affordance while the mutation and the database constraint remain
 * the enforcing layers.
 *
 * Join shape: options and total memberships fan out against each
 * other (4 options × 3 quiz uses = 12 rows), so plain count() would
 * inflate both aggregates — count(DISTINCT id) keeps each exact
 * (TASK 030 pattern). The targeted "in this quiz" LEFT JOIN is safe
 * 1:1 thanks to UNIQUE(quiz_id, question_id) and never fans out.
 */

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export type BankQuestionCandidate = {
  id: string;
  questionText: string;
  optionCount: number;
  usedInCount: number;
  /** True when the question already sits in THIS quiz (CMS §23). */
  inThisQuiz: boolean;
};

export type BankQuestionResult = {
  rows: BankQuestionCandidate[];
  total: number;
  page: number;
  pageCount: number;
};

export async function searchBankQuestions(
  query: LessonQuizSearchQuery,
  /** null while the lesson has no quiz row yet (nothing is assigned). */
  quizId: string | null,
): Promise<BankQuestionResult> {
  const textFilter = query.qq
    ? ilike(questions.questionText, `%${escapeLike(query.qq)}%`)
    : undefined;

  const totalRows = await db
    .select({ value: count() })
    .from(questions)
    .where(textFilter);
  const total = totalRows[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / QUESTION_LIST_PAGE_SIZE));

  // Out-of-range pages clamp to the last existing page (TASK 016).
  const page = Math.min(Math.max(query.qpage ?? 1, 1), pageCount);
  const offset = (page - 1) * QUESTION_LIST_PAGE_SIZE;

  // bool_or — Postgres defines no max(boolean); left-join NULLs fold
  // to NULL (=== true maps them to false below).
  const inThisQuizExpr = quizId
    ? sql<boolean>`(${quizQuestions.quizId} = ${quizId})`
    : sql<boolean>`false`;

  const rows = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      optionCount: countDistinct(questionOptions.id),
      usedInCount: countDistinct(quizQuestions.id),
      inThisQuiz: sql<boolean | null>`bool_or(${inThisQuizExpr})`,
    })
    .from(questions)
    .leftJoin(
      questionOptions,
      eq(questionOptions.questionId, questions.id),
    )
    .leftJoin(
      quizQuestions,
      eq(quizQuestions.questionId, questions.id),
    )
    .where(textFilter)
    .groupBy(questions.id)
    .orderBy(desc(questions.updatedAt), desc(questions.id))
    .limit(QUESTION_LIST_PAGE_SIZE)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      questionText: row.questionText,
      optionCount: row.optionCount,
      usedInCount: row.usedInCount,
      inThisQuiz: row.inThisQuiz === true,
    })),
    total,
    page,
    pageCount,
  };
}
