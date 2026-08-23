import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  courses,
  lessons,
  questionOptions,
  questions,
  quizQuestions,
  quizzes,
} from "@/db/schema";

import type { EditableQuestion } from "../schemas/question-form.schema";

/**
 * Question editor query (TASK 031, CMS §22/§24; TASK 032, CMS §23).
 *
 * Loads one bank Question with its options in the persisted
 * sort_order (the order the editor form re-submits as its row
 * order) plus the quiz memberships the edit page renders twice:
 * the CMS §24 reuse count ("used in N quizzes" editing warning,
 * derived from the list length) and the CMS §23 membership view
 * (which quizzes use this question — reuse is intentional, so the
 * list is unbounded and read-only; selecting questions FOR a quiz
 * is the TASK 033/034 builders' job).
 *
 * The membership join resolves each quiz's owning Lesson (LESSON
 * type) or Course (FINAL type) title — the quizzes.type ownership
 * CHECK guarantees exactly one is set, so the coalesce is total.
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

  const usageRows = await db
    .select({
      quizId: quizzes.id,
      quizTitle: quizzes.title,
      quizType: quizzes.type,
      lessonTitle: lessons.title,
      courseTitle: courses.title,
    })
    .from(quizQuestions)
    .innerJoin(quizzes, eq(quizzes.id, quizQuestions.quizId))
    .leftJoin(lessons, eq(lessons.id, quizzes.lessonId))
    .leftJoin(courses, eq(courses.id, quizzes.courseId))
    .where(eq(quizQuestions.questionId, questionId))
    .orderBy(asc(quizzes.title), asc(quizzes.id));

  const usedIn = usageRows.map((row) => ({
    quizId: row.quizId,
    quizTitle: row.quizTitle,
    quizType: row.quizType,
    ownerTitle: (row.lessonTitle ?? row.courseTitle) as string,
  }));

  return {
    id: question.id,
    questionText: question.questionText,
    explanation: question.explanation,
    options,
    usedIn,
  };
}
