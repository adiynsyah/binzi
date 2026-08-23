import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  lessons,
  questionOptions,
  questions,
  quizQuestions,
  quizzes,
} from "@/db/schema";
import type { PublishCheck } from "@/features/courses/schemas/publish.schema";

/**
 * BINZI centralized quiz publication rules (TASK 035, Task Plan "Quiz
 * Publish Validation"; Architecture Spec §10 quiz.service.ts).
 *
 * This module is the single authoritative home of the quiz readiness
 * rules that TASK 033/034 deliberately left display-only:
 *
 * - Lesson Quiz  — exactly 10 Questions            (BR §11, CMS §19.5)
 * - Final Quiz   — 10–30 Questions                 (BR §16, CMS §29.7)
 * - Every Question used by a published Quiz has valid options
 *   (≥ 2 — the 2–10 save-time range from TASK 031) and exactly one
 *   correct option                                 (BR §14/§15, CMS §19.6–7)
 *
 * Per Business Rules §31 these are SERVICE-LAYER workflow rules, not
 * database constraints; per BR §32 the UI may guide but this server
 * side validation is the authority. Quizzes themselves carry NO
 * publication status (approved decision #17) — "publishing a quiz"
 * means publishing the LESSON or COURSE that owns it, and both publish
 * mutations (features/courses/mutations/publishLesson|publishCourse)
 * call THESE functions against the persisted database state, never
 * client-submitted fields.
 *
 * BR §19 fixes one global passing score with a central constant,
 * QUIZ_PASSING_SCORE = 80. It is a scoring rule, not a publish gate
 * (nothing on a quiz row to validate against it) — it is centralized
 * here per the Task Plan 035 rule list and first consumed by the
 * TASK 050 server-side scoring.
 *
 * Concurrency: callers run these reads AFTER taking the course-row
 * FOR UPDATE lock inside their publish transaction. Every structure
 * mutation in TASK 025–034 locks the course row first, so once the
 * publish flow holds that lock any competing builder transaction has
 * either already committed (visible to these reads under READ
 * COMMITTED) or is blocked until the publish commits — the validated
 * state cannot change underneath the transition.
 */

/** BR §19: V1's single global passing score (percent). */
export const QUIZ_PASSING_SCORE = 80;

/** BR §11 / CMS §19.5: a Lesson Quiz has exactly 10 Questions. */
export const LESSON_QUIZ_REQUIRED_QUESTION_COUNT = 10;

/** BR §16 / CMS §29.7: a Final Quiz has 10–30 Questions. */
export const FINAL_QUIZ_MIN_QUESTION_COUNT = 10;
export const FINAL_QUIZ_MAX_QUESTION_COUNT = 30;

/** CMS §19.6 "valid options": at least 2 (TASK 031 save range is 2–10). */
const MIN_OPTIONS_PER_QUESTION = 2;

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persisted per-question aggregates for every Question assigned to the
 * given quizzes: option count and correct-option count. A Question is
 * invalid for publication when optionCount < 2 (no valid multiple
 * choice) or correctCount !== 1 (zero or multiple correct answers —
 * BR §14/§15). Reads the AUTHORITATIVE options rows; nothing is
 * trusted from the client. Returns the violation count PER QUIZ so a
 * course-level checklist can attribute failures to the right lesson.
 */
async function countQuestionViolationsPerQuiz(
  quizIds: string[],
): Promise<Map<string, number>> {
  const violations = new Map<string, number>();
  if (quizIds.length === 0) {
    return violations;
  }

  const rows = await db
    .select({
      quizId: quizQuestions.quizId,
      optionCount: sql<number>`count(${questionOptions.id})::int`,
      correctCount: sql<number>`coalesce(sum(case when ${questionOptions.isCorrect} then 1 else 0 end), 0)::int`,
    })
    .from(quizQuestions)
    .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
    .leftJoin(
      questionOptions,
      eq(questionOptions.questionId, quizQuestions.questionId),
    )
    .where(inArray(quizQuestions.quizId, quizIds))
    .groupBy(quizQuestions.quizId, quizQuestions.questionId);

  for (const row of rows) {
    if (
      row.optionCount < MIN_OPTIONS_PER_QUESTION ||
      row.correctCount !== 1
    ) {
      violations.set(row.quizId, (violations.get(row.quizId) ?? 0) + 1);
    }
  }

  return violations;
}

/** Total violations across the given quizzes (single-quiz callers). */
async function countQuestionViolations(quizIds: string[]): Promise<number> {
  const perQuiz = await countQuestionViolationsPerQuiz(quizIds);
  let total = 0;
  for (const count of perQuiz.values()) {
    total += count;
  }
  return total;
}

/** Persisted membership count of one quiz (its quiz_questions rows). */
async function countQuizQuestions(quizId: string): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId));
  return rows[0]?.total ?? 0;
}

function quizExistsCheck(
  exists: boolean,
  /** Names the quiz kind in the label: "Pelajaran" | "Akhir". */
  noun: "Pelajaran" | "Akhir",
): PublishCheck {
  return {
    id: `${noun === "Pelajaran" ? "lesson" : "final"}-quiz-exists`,
    state: exists ? "pass" : "fail",
    label: exists
      ? `Kuis ${noun} sudah dibuat.`
      : `Kuis ${noun} belum dibuat.`,
  };
}

function quizCountCheck(
  labelPrefix: string,
  count: number,
  required: string,
): PublishCheck {
  return {
    id: `${labelPrefix}-quiz-count`,
    state: "fail",
    label: `Jumlah soal belum tepat — ${count} soal (wajib ${required}).`,
  };
}

/**
 * Quiz publication checks for ONE Lesson Quiz (CMS §19.4–7).
 *
 * Returns three checks: quiz existence, the exactly-10 membership
 * count read from the persisted quiz_questions rows, and per-question
 * option/correctness validity. `null` callers treat a missing quiz as
 * a failing checklist, never as an error — the lesson publish
 * workflow shows it as an actionable prerequisite (CMS §19 "show a
 * checklist", never a generic failure).
 */
export async function getLessonQuizPublishChecks(
  lessonId: string,
): Promise<PublishCheck[]> {
  if (!UUID_PATTERN.test(lessonId)) {
    return [
      quizExistsCheck(false, "Pelajaran"),
      quizCountCheck("lesson", 0, "tepat 10"),
    ];
  }

  const quizRows = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    // Ownership is part of the match itself (UNIQUE(lesson_id) makes
    // this row THE lesson's quiz; type doubles as a sanity guard).
    .where(and(eq(quizzes.lessonId, lessonId), eq(quizzes.type, "LESSON")))
    .limit(1);

  const quiz = quizRows[0];
  if (!quiz) {
    return [
      quizExistsCheck(false, "Pelajaran"),
      quizCountCheck("lesson", 0, "tepat 10"),
    ];
  }

  const count = await countQuizQuestions(quiz.id);
  const violations = await countQuestionViolations([quiz.id]);

  return [
    quizExistsCheck(true, "Pelajaran"),
    {
      id: "lesson-quiz-count",
      state: count === LESSON_QUIZ_REQUIRED_QUESTION_COUNT ? "pass" : "fail",
      label:
        count === LESSON_QUIZ_REQUIRED_QUESTION_COUNT
          ? `Kuis Pelajaran berisi tepat ${LESSON_QUIZ_REQUIRED_QUESTION_COUNT} soal.`
          : `Kuis Pelajaran berisi ${count} soal — wajib tepat ${LESSON_QUIZ_REQUIRED_QUESTION_COUNT}.`,
    },
    {
      id: "lesson-quiz-questions-valid",
      state: violations === 0 ? "pass" : "fail",
      label:
        violations === 0
          ? "Semua soal valid (≥2 opsi, tepat satu jawaban benar)."
          : `${violations} soal tidak valid (opsi kurang dari 2 atau jawaban benar bukan tepat satu).`,
    },
  ];
}

/**
 * Quiz publication checks for the Course's Final Quiz (CMS §29.6–7,
 * BR §16). Mirrors the Lesson Quiz checks with the 10–30 range.
 */
export async function getFinalQuizPublishChecks(
  courseId: string,
): Promise<PublishCheck[]> {
  if (!UUID_PATTERN.test(courseId)) {
    return [
      quizExistsCheck(false, "Akhir"),
      quizCountCheck("final", 0, "10–30"),
    ];
  }

  const quizRows = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.courseId, courseId), eq(quizzes.type, "FINAL")))
    .limit(1);

  const quiz = quizRows[0];
  if (!quiz) {
    return [
      quizExistsCheck(false, "Akhir"),
      quizCountCheck("final", 0, "10–30"),
    ];
  }

  const count = await countQuizQuestions(quiz.id);
  const violations = await countQuestionViolations([quiz.id]);
  const inRange =
    count >= FINAL_QUIZ_MIN_QUESTION_COUNT &&
    count <= FINAL_QUIZ_MAX_QUESTION_COUNT;

  return [
    quizExistsCheck(true, "Akhir"),
    {
      id: "final-quiz-count",
      state: inRange ? "pass" : "fail",
      label: inRange
        ? `Kuis Akhir berisi ${count} soal (rentang ${FINAL_QUIZ_MIN_QUESTION_COUNT}–${FINAL_QUIZ_MAX_QUESTION_COUNT}).`
        : `Kuis Akhir berisi ${count} soal — di luar rentang ${FINAL_QUIZ_MIN_QUESTION_COUNT}–${FINAL_QUIZ_MAX_QUESTION_COUNT}.`,
    },
    {
      id: "final-quiz-questions-valid",
      state: violations === 0 ? "pass" : "fail",
      label:
        violations === 0
          ? "Semua soal valid (≥2 opsi, tepat satu jawaban benar)."
          : `${violations} soal tidak valid (opsi kurang dari 2 atau jawaban benar bukan tepat satu).`,
    },
  ];
}

/**
 * Per-lesson quiz publication checks for EVERY lesson of a course
 * (CMS §29.4–5: "Each Lesson has exactly one Lesson Quiz" with
 * "exactly 10 Questions"). Used by the course publish mutation and
 * the Course Builder readiness checklist — one check per lesson, in
 * the course's persisted lesson order, so the admin sees exactly
 * which lesson is not ready (CMS §48 guidance principle).
 */
export async function getCourseLessonQuizPublishChecks(
  courseId: string,
): Promise<PublishCheck[]> {
  if (!UUID_PATTERN.test(courseId)) {
    return [];
  }

  const lessonRows = await db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.sortOrder));

  if (lessonRows.length === 0) {
    return [];
  }

  // One set-based pass: every (lesson → its quiz → membership count).
  const membershipRows = await db
    .select({
      lessonId: quizzes.lessonId,
      quizId: quizzes.id,
      total: sql<number>`count(${quizQuestions.id})::int`,
    })
    .from(quizzes)
    .leftJoin(quizQuestions, eq(quizQuestions.quizId, quizzes.id))
    .where(
      inArray(
        quizzes.lessonId,
        lessonRows.map((lesson) => lesson.id),
      ),
    )
    .groupBy(quizzes.lessonId, quizzes.id);

  const quizIds = membershipRows.map((row) => row.quizId);
  const violationsPerQuiz = await countQuestionViolationsPerQuiz(quizIds);

  return lessonRows.map((lesson) => {
    const membership = membershipRows.find(
      (row) => row.lessonId === lesson.id,
    );
    const count = membership?.total ?? 0;
    const violations = membership
      ? (violationsPerQuiz.get(membership.quizId) ?? 0)
      : 0;
    const ok =
      !!membership &&
      count === LESSON_QUIZ_REQUIRED_QUESTION_COUNT &&
      violations === 0;
    return {
      id: `lesson-quiz:${lesson.id}`,
      state: ok ? ("pass" as const) : ("fail" as const),
      label: ok
        ? `Kuis Pelajaran "${lesson.title}" berisi tepat ${LESSON_QUIZ_REQUIRED_QUESTION_COUNT} soal.`
        : `Kuis Pelajaran "${lesson.title}" belum siap — ${count} soal (wajib tepat ${LESSON_QUIZ_REQUIRED_QUESTION_COUNT})${violations > 0 ? `, ${violations} soal tidak valid` : ""}.`,
    };
  });
}
