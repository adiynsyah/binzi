import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { quizzes } from "@/db/schema";

/**
 * Final Quiz builder data access (TASK 034, CMS Spec §7/§20/§25).
 *
 * Server-side, read-only query through the single Drizzle client.
 *
 * getFinalQuiz returns the course's ONE Final Quiz row — the match
 * itself requires (course_id, type = 'FINAL'), so a quiz of another
 * course (or any Lesson Quiz) can never leak into this course's
 * builder context. A course whose Final Quiz row has not been
 * materialized yet (createCourse of TASK 023 writes no quiz row —
 * the quiz row is created lazily by the first add-question mutation)
 * returns null; the builder renders the same empty surface either
 * way. The assigned Questions themselves are loaded by the generic
 * getQuizQuestions(quizId) from TASK 033 — quiz_questions has no
 * LESSON/FINAL distinction of its own.
 */

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FinalQuizSummary = {
  id: string;
  title: string;
};

/**
 * Loads the course's Final Quiz, or null when no quiz row exists yet.
 * Malformed course ids also return null (page renders a plain 404
 * before reaching here anyway — TASK 024 convention).
 */
export async function getFinalQuiz(
  courseId: string,
): Promise<FinalQuizSummary | null> {
  if (!UUID_PATTERN.test(courseId)) {
    return null;
  }

  const rows = await db
    .select({ id: quizzes.id, title: quizzes.title })
    .from(quizzes)
    .where(and(eq(quizzes.courseId, courseId), eq(quizzes.type, "FINAL")))
    .limit(1);

  return rows[0] ?? null;
}
