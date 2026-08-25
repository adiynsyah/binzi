import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { questionOptions, questions, quizQuestions } from "@/db/schema";

/**
 * Quiz player data access (TASK 049, Task Plan "Quiz Player" —
 * "Question X of Y / Single answer / Next / Submit"; UI/UX §18–§20;
 * Architecture §19 anti-tampering principle).
 *
 * Server-side, read-only query through the single Drizzle client.
 * Loads a quiz's Questions and their Options in the persisted
 * quiz_questions / question_options sort order — the same ordering
 * discipline as TASK 031/033.
 *
 * CORRECTNESS IS DELIBERATELY NOT SELECTED: is_correct never leaves
 * the server through this query. The player renders neutral options;
 * the authoritative correct answers are loaded again, server-side
 * only, by the scoring flow (TASK 050 — Architecture §18/§19: the
 * client may send questionId + selectedOptionId, never score/passed).
 * The question/option ids themselves ARE the designed client contract
 * for that future submission, so they are carried in the payload.
 *
 * Quiz-kind-agnostic by construction (quiz_questions carries no
 * LESSON/FINAL distinction — the TASK 034 note): the caller resolves
 * WHICH quiz via the access services (canAccessLessonQuiz 048, later
 * canAccessFinalQuiz 055) and passes the server-resolved quiz id; it
 * never comes from client input.
 */

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlayerOption = {
  id: string;
  text: string;
};

export type PlayerQuestion = {
  id: string;
  text: string;
  options: PlayerOption[];
};

/**
 * The quiz's Questions with Options, in persisted order. A quiz whose
 * membership is empty returns an empty list (the player renders its
 * honest empty state); a malformed quiz id also returns empty — the
 * route's access gate resolves the quiz long before this runs.
 */
export async function getQuizForPlayer(
  quizId: string,
): Promise<PlayerQuestion[]> {
  if (!UUID_PATTERN.test(quizId)) {
    return [];
  }

  const questionRows = await db
    .select({
      questionId: questions.id,
      questionText: questions.questionText,
    })
    .from(quizQuestions)
    .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.sortOrder));

  if (questionRows.length === 0) {
    return [];
  }

  const optionRows = await db
    .select({
      questionId: questionOptions.questionId,
      optionId: questionOptions.id,
      optionText: questionOptions.optionText,
    })
    .from(questionOptions)
    .where(
      inArray(
        questionOptions.questionId,
        questionRows.map((row) => row.questionId),
      ),
    )
    .orderBy(asc(questionOptions.sortOrder));

  const optionsByQuestion = new Map<string, PlayerOption[]>();
  for (const row of optionRows) {
    const list = optionsByQuestion.get(row.questionId) ?? [];
    list.push({ id: row.optionId, text: row.optionText });
    optionsByQuestion.set(row.questionId, list);
  }

  return questionRows.map((row) => ({
    id: row.questionId,
    text: row.questionText,
    options: optionsByQuestion.get(row.questionId) ?? [],
  }));
}
