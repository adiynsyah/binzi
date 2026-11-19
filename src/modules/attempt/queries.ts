// Database access for the attempt domain (card S3-01 §1).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
//
// Same table pattern as the progress module: this file reads the
// quizzes/questions/question_options/quiz_attempts/quiz_answers TABLES plus
// the lessons/courses rows a quiz attempt needs, without importing any other
// module's files. Ownership is in the WHERE (`user_id = actor` on every
// attempt lookup — anti-IDOR in two layers, PRD §12.6 V-05).
import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { db } from "@/db";
import { courses, lessons, questionOptions, questions, quizAnswers, quizAttempts, quizzes } from "@/db/schema";

import type {
  AttemptAnswerRow,
  AttemptOptionRow,
  AttemptQuestionRow,
  AttemptRow,
  AttemptStatus,
  QuizSettingsRow,
  QuizType,
} from "./serializer";

/** Transaction executor, spelled out locally (progress-module pattern). */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbOrTx = Db | DbTx;

// ------------------------------------------------------------------ the page

/**
 * Slug resolution for the quiz page (card §1): the PUBLISHED course + its
 * lesson, carrying lessons.quiz_id. Every miss (unknown course, unpublished,
 * unknown slug, slug of another course) is `undefined` → the SAME 404, so
 * existence never leaks.
 */
export async function selectQuizLessonBySlugs(
  courseSlug: string,
  lessonSlug: string,
): Promise<
  { lessonId: string; quizId: string | null; lessonTitle: string } | undefined
> {
  const rows = await db
    .select({
      lessonId: lessons.id,
      quizId: lessons.quizId,
      lessonTitle: lessons.title,
    })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(
      and(
        eq(courses.slug, courseSlug),
        eq(courses.status, "PUBLISHED"),
        eq(lessons.slug, lessonSlug),
      ),
    )
    .limit(1);
  return rows[0];
}

/** The quizzes settings row (duration, passing score, shuffle, policy).
 *  Card S5-02 §2 adds `type` — the submit path branches on LESSON/FINAL. */
export async function selectQuizSettings(
  executor: DbOrTx,
  quizId: string,
): Promise<QuizSettingsRow | undefined> {
  const rows = await executor
    .select({
      id: quizzes.id,
      type: quizzes.type,
      title: quizzes.title,
      durationMinutes: quizzes.durationMinutes,
      passingScorePercent: quizzes.passingScorePercent,
      shuffleQuestions: quizzes.shuffleQuestions,
      shuffleOptions: quizzes.shuffleOptions,
      explanationPolicy: quizzes.explanationPolicy,
    })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  return rows[0];
}

/** The quiz's questions in storage order — `order_index asc, id asc`, the
 *  exact order a non-shuffled attempt locks in (card §1). */
export async function selectQuizQuestions(
  executor: DbOrTx,
  quizId: string,
): Promise<AttemptQuestionRow[]> {
  return executor
    .select({
      id: questions.id,
      orderIndex: questions.orderIndex,
      type: questions.type,
      text: questions.text,
      explanation: questions.explanation,
      points: questions.points,
    })
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderIndex), asc(questions.id));
}

/**
 * Every option of every question of the quiz. is_correct rides along for
 * the SUBMIT path and the result DTO; the running DTO drops it in the
 * serializer (orderOptions), never here.
 */
export async function selectQuizOptions(
  executor: DbOrTx,
  quizId: string,
): Promise<AttemptOptionRow[]> {
  return executor
    .select({
      questionId: questionOptions.questionId,
      id: questionOptions.id,
      orderIndex: questionOptions.orderIndex,
      text: questionOptions.text,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .innerJoin(questions, eq(questionOptions.questionId, questions.id))
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questionOptions.orderIndex), asc(questionOptions.id));
}

/**
 * The actor's LIVE attempt of the quiz (reset_at IS NULL, card §1): the
 * current one, or the finalized one the page shows results for. Never
 * returns an admin-reset row (QZ-19 resets are history, not state).
 */
export async function selectAttemptByQuizAndUser(
  executor: DbOrTx,
  quizId: string,
  userId: string,
): Promise<AttemptRow | undefined> {
  const rows = await executor
    .select({
      id: quizAttempts.id,
      quizId: quizAttempts.quizId,
      userId: quizAttempts.userId,
      enrollmentId: quizAttempts.enrollmentId,
      status: quizAttempts.status,
      questionOrder: quizAttempts.questionOrder,
      startedAt: quizAttempts.startedAt,
      expiresAt: quizAttempts.expiresAt,
      submittedAt: quizAttempts.submittedAt,
      score: quizAttempts.score,
      maxScore: quizAttempts.maxScore,
      scorePercent: quizAttempts.scorePercent,
      isPassed: quizAttempts.isPassed,
    })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.userId, userId),
        sql`${quizAttempts.resetAt} is null`,
      ),
    )
    .orderBy(desc(quizAttempts.attemptNumber))
    .limit(1);
  return rows[0];
}

// --------------------------------------------------------------------- start

/**
 * max(attempt_number) of the actor's attempts on this quiz — INCLUDING
 * reset rows (QZ-19: a reset grants a new attempt, never number 1 again) —
 * plus one.
 */
export async function selectNextAttemptNumber(
  executor: DbOrTx,
  quizId: string,
  userId: string,
): Promise<number> {
  const rows = await executor
    .select({
      max: sql<string | null>`max(${quizAttempts.attemptNumber})`,
    })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId)),
    );
  return Number(rows[0]?.max ?? 0) + 1;
}

/**
 * The start insert (card §1): the `one_active_attempt` partial unique index
 * (quiz_id, user_id WHERE status = 'IN_PROGRESS') is the ONLY guard against
 * a double-click race — never a pre-check. `undefined` means the insert was
 * suppressed and the winner's row must be selected back.
 */
export async function insertAttempt(
  tx: DbTx,
  input: {
    quizId: string;
    userId: string;
    enrollmentId: string;
    attemptNumber: number;
    questionOrder: string[];
    startedAt: Date;
    expiresAt: Date;
  },
): Promise<string | undefined> {
  const rows = await tx
    .insert(quizAttempts)
    .values({
      quizId: input.quizId,
      userId: input.userId,
      enrollmentId: input.enrollmentId,
      attemptNumber: input.attemptNumber,
      status: "IN_PROGRESS",
      questionOrder: input.questionOrder,
      startedAt: input.startedAt,
      expiresAt: input.expiresAt,
    })
    .onConflictDoNothing({
      target: [quizAttempts.quizId, quizAttempts.userId],
      // The partial index's predicate (renders right after the conflict
      // target — DO NOTHING takes no row-level where).
      where: sql`${quizAttempts.status} = 'IN_PROGRESS'`,
    })
    .returning({ id: quizAttempts.id });
  return rows[0]?.id;
}

// ------------------------------------------------------------- save / submit

/**
 * The save/submit lock (card §1): SELECT … FOR UPDATE over quiz_attempts,
 * with ownership in the WHERE — another participant's attempt id answers
 * `undefined` → 404, exactly like an unknown one (anti-IDOR, V-05). The
 * lock is taken FIRST; every later read in the transaction sees this row.
 */
export async function findAttemptForUpdate(
  executor: DbTx,
  attemptId: string,
  actorId: string,
): Promise<AttemptRow | undefined> {
  const rows = await executor
    .select({
      id: quizAttempts.id,
      quizId: quizAttempts.quizId,
      userId: quizAttempts.userId,
      enrollmentId: quizAttempts.enrollmentId,
      status: quizAttempts.status,
      questionOrder: quizAttempts.questionOrder,
      startedAt: quizAttempts.startedAt,
      expiresAt: quizAttempts.expiresAt,
      submittedAt: quizAttempts.submittedAt,
      score: quizAttempts.score,
      maxScore: quizAttempts.maxScore,
      scorePercent: quizAttempts.scorePercent,
      isPassed: quizAttempts.isPassed,
    })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, actorId)),
    )
    .limit(1)
    .for("update", { of: quizAttempts });
  return rows[0];
}

/**
 * Ownership-free membership check for the save path: the option must belong
 * to exactly this question. Combined with the question_order check in the
 * service, an option id from another quiz can never be stored.
 */
export async function selectOptionBelongsToQuestion(
  executor: DbOrTx,
  questionId: string,
  optionId: string,
): Promise<boolean> {
  const rows = await executor
    .select({ id: questionOptions.id })
    .from(questionOptions)
    .where(
      and(
        eq(questionOptions.id, optionId),
        eq(questionOptions.questionId, questionId),
      ),
    )
    .limit(1);
  return rows.length === 1;
}

/**
 * Auto-save upsert (card §1): selected_option_id + answered_at only.
 * is_correct / points_earned are NEVER written here — grading happens once,
 * at submit (PRD §6.3, V-01).
 */
export async function upsertQuizAnswer(
  tx: DbTx,
  input: {
    attemptId: string;
    questionId: string;
    selectedOptionId: string;
    answeredAt: Date;
  },
): Promise<void> {
  await tx
    .insert(quizAnswers)
    .values({
      attemptId: input.attemptId,
      questionId: input.questionId,
      selectedOptionId: input.selectedOptionId,
      answeredAt: input.answeredAt,
    })
    .onConflictDoUpdate({
      target: [quizAnswers.attemptId, quizAnswers.questionId],
      set: {
        selectedOptionId: sql`excluded.selected_option_id`,
        answeredAt: sql`excluded.answered_at`,
      },
    });
}

/** The attempt's saved answers — selected ids only, no grading columns. */
export async function selectAttemptAnswers(
  executor: DbOrTx,
  attemptId: string,
): Promise<AttemptAnswerRow[]> {
  return executor
    .select({
      questionId: quizAnswers.questionId,
      selectedOptionId: quizAnswers.selectedOptionId,
    })
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, attemptId))
    .orderBy(asc(quizAnswers.questionId));
}

/**
 * The finalize update (card §1 submit): status, score columns,
 * submitted_at — one typed statement. is_passed comes from the service's
 * comparison against passing_score_percent.
 */
export async function finalizeAttempt(
  tx: DbTx,
  input: {
    attemptId: string;
    status: "SUBMITTED" | "EXPIRED";
    score: number;
    maxScore: number;
    scorePercent: number;
    isPassed: boolean;
    submittedAt: Date;
  },
): Promise<void> {
  await tx
    .update(quizAttempts)
    .set({
      status: input.status,
      score: input.score,
      maxScore: input.maxScore,
      scorePercent: input.scorePercent.toFixed(2),
      isPassed: input.isPassed,
      submittedAt: input.submittedAt,
    })
    .where(eq(quizAttempts.id, input.attemptId));
}

/**
 * Grade one saved answer (card §1 submit, separate statements after the
 * score math): is_correct + points_earned, written only at finalize time.
 */
export async function setAnswerGrade(
  tx: DbTx,
  input: {
    attemptId: string;
    questionId: string;
    isCorrect: boolean;
    pointsEarned: number;
  },
): Promise<void> {
  await tx
    .update(quizAnswers)
    .set({
      isCorrect: input.isCorrect,
      pointsEarned: input.pointsEarned,
    })
    .where(
      and(
        eq(quizAnswers.attemptId, input.attemptId),
        eq(quizAnswers.questionId, input.questionId),
      ),
    );
}

/**
 * The lesson a quiz belongs to (quiz type LESSON, card §1): submit needs it
 * to hand lessonId to the progress module's recordLessonQuizResult. A LESSON
 * quiz without a lesson row is unreachable with valid data — the service
 * fails loud rather than silently skipping progress recording.
 */
export async function selectLessonIdByQuizId(
  executor: DbOrTx,
  quizId: string,
): Promise<string | undefined> {
  const rows = await executor
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.quizId, quizId))
    .limit(1);
  return rows[0]?.id;
}

// ------------------------------------------------------ S5-02 final quiz

/**
 * The course a FINAL quiz belongs to (card S5-02 §2): courses.final_quiz_id
 * is UNIQUE, so at most one row. The submit transaction needs the courseId
 * for the progress module's recordFinalQuizResult.
 */
export async function selectCourseIdByFinalQuizId(
  executor: DbOrTx,
  quizId: string,
): Promise<string | undefined> {
  const rows = await executor
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.finalQuizId, quizId))
    .limit(1);
  return rows[0]?.id;
}

/**
 * The submit PRE-READ (card S5-02 §2, owner addition): the actor's
 * attempt's quiz type + status, WITHOUT a lock and on plain `db` — used
 * only to decide whether getScoreWeights must run BEFORE the transaction
 * (awaiting a `db` query inside db.transaction deadlocks on PGlite). The
 * transaction re-reads everything under its lock and stays the only
 * decision maker; a missing attempt here changes nothing (the transaction
 * answers the one 404). Ownership is in the WHERE (anti-IDOR, V-05).
 */
export async function selectSubmitPreread(
  attemptId: string,
  actorId: string,
): Promise<{ quizType: QuizType; status: AttemptStatus } | undefined> {
  const rows = await db
    .select({
      quizType: quizzes.type,
      status: quizAttempts.status,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .where(
      and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, actorId)),
    )
    .limit(1);
  return rows[0];
}
