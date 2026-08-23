import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { questions, quizQuestions, quizzes } from "@/db/schema";

/**
 * Lesson Quiz builder data access (TASK 033, CMS Spec §9/§21/§25).
 *
 * Server-side, read-only queries through the single Drizzle client.
 *
 * getLessonQuiz returns the lesson's ONE Lesson Quiz row — the match
 * itself requires (lesson_id, type = 'LESSON'), so a quiz of another
 * lesson (or a Course's Final Quiz) can never leak into this lesson's
 * builder context. A lesson whose quiz row has not been materialized
 * yet (lessons created by TASK 025 carry no quiz — the quiz row is
 * created lazily by the first add-question mutation) returns
 * quizId null with an empty item list; the builder renders the same
 * "0 / 10" surface either way.
 *
 * getQuizQuestions returns the assigned Questions in the quiz's
 * explicit sort_order (UNIQUE(quiz_id, sort_order), CHECK > 0):
 * ascending sort is fully deterministic with no tie-breaker needed
 * (the same ordering discipline as TASK 028/029).
 */

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LessonQuizSummary = {
  id: string;
  title: string;
};

/**
 * Loads the lesson's Lesson Quiz, or null when no quiz row exists yet.
 * Malformed lesson ids also return null (page renders a plain 404
 * before reaching here anyway — TASK 028 convention).
 */
export async function getLessonQuiz(
  lessonId: string,
): Promise<LessonQuizSummary | null> {
  if (!UUID_PATTERN.test(lessonId)) {
    return null;
  }

  const rows = await db
    .select({ id: quizzes.id, title: quizzes.title })
    .from(quizzes)
    .where(and(eq(quizzes.lessonId, lessonId), eq(quizzes.type, "LESSON")))
    .limit(1);

  return rows[0] ?? null;
}

export type AssignedQuizQuestionItem = {
  questionId: string;
  questionText: string;
  sortOrder: number;
};

/** Assigned Questions of a quiz, in persisted order (CMS §25). */
export async function getQuizQuestions(
  quizId: string,
): Promise<AssignedQuizQuestionItem[]> {
  if (!UUID_PATTERN.test(quizId)) {
    return [];
  }

  return db
    .select({
      questionId: quizQuestions.questionId,
      questionText: questions.questionText,
      sortOrder: quizQuestions.sortOrder,
    })
    .from(quizQuestions)
    .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.sortOrder));
}
