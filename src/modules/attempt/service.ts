// Service layer for the attempt module (card S3-01 §1) — the ONLY surface
// other modules may import (src/modules/README.md). Guard order everywhere:
// role FIRST, then input, then ownership/timing. The one-way dependency on
// the progress module (context gate + result recording) goes through ITS
// service.ts, never its queries.
import { randomInt } from "node:crypto";

import type { SessionUser } from "@/lib/rbac";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { db } from "@/db";
import {
  getEnrollmentFinalResult,
  lessonHref,
  loadFinalQuizContext,
  loadLessonQuizContext,
  recordFinalQuizResult,
  recordLessonQuizResult,
} from "@/modules/progress/service";
import { getScoreWeights, type ScoreWeights } from "@/modules/quiz/service";

import type {
  SaveQuizAnswerInput,
  StartFinalQuizInput,
  StartQuizInput,
  SubmitQuizInput,
} from "./schema";
import { assertMemberRole, withinTolerance } from "./policy";
import {
  findAttemptForUpdate,
  finalizeAttempt,
  insertAttempt,
  selectAttemptAnswers,
  selectAttemptByQuizAndUser,
  selectCourseIdByFinalQuizId,
  selectLessonIdByQuizId,
  selectNextAttemptNumber,
  selectOptionBelongsToQuestion,
  selectQuizLessonBySlugs,
  selectQuizOptions,
  selectQuizQuestions,
  selectQuizSettings,
  selectSubmitPreread,
  setAnswerGrade,
  upsertQuizAnswer,
  type DbTx,
} from "./queries";
import {
  toFinalQuizResultDTO,
  toQuizResultDTO,
  toQuizRunningDTO,
  toQuizRulesDTO,
  type FinalQuizPageDTO,
  type FinalQuizResultDTO,
  type FinalQuizRulesDTO,
  type LessonQuizPageDTO,
  type QuizResultDTO,
  type QuizResultItemDTO,
  type QuizRulesDTO,
  type QuizRunningDTO,
} from "./serializer";

export type {
  FinalQuizPageDTO,
  FinalQuizResultDTO,
  FinalQuizRulesDTO,
  LessonQuizPageDTO,
  QuizResultDTO,
  QuizResultItemDTO,
  QuizRulesDTO,
  QuizRunningDTO,
};

/** Owner decision 8's question half: Fisher–Yates over the storage order
 *  with node:crypto's randomInt — unbiased index picks, server-side only
 *  (the option half is the seeded orderer in the serializer, so the result
 *  screen can rebuild the same order without storing it). */
function shuffleQuestionIds(ordered: readonly string[]): string[] {
  const ids = [...ordered];
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const swap = ids[j]!;
    ids[j] = ids[i]!;
    ids[i] = swap;
  }
  return ids;
}

// ------------------------------------------------------------------ the page

/**
 * The quiz page (card S3-01 §1) — a pure GET: NO attempt is finalized here
 * (owner decision 6; the expiry screen's beacon submits). State machine:
 * locked lesson or not-yet-eligible video → `kembali` (the lesson page
 * renders both properly); no live attempt → `aturan`; IN_PROGRESS inside
 * the tolerance window → `berjalan`; IN_PROGRESS past it → `kedaluwarsa`;
 * a final attempt → `hasil`.
 */
export async function getLessonQuizPage(
  actor: SessionUser,
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonQuizPageDTO> {
  assertMemberRole(actor);
  const target = await selectQuizLessonBySlugs(courseSlug, lessonSlug);
  if (!target) {
    throw new NotFoundError("Materi tidak ditemukan.");
  }
  if (target.quizId === null) {
    // A lesson without a quiz has no quiz page — same 404 shape as the
    // miss above; the card's "no-quiz defensive 404".
    throw new NotFoundError("Quiz tidak ditemukan.");
  }

  let context;
  try {
    context = await loadLessonQuizContext(db, actor.id, target.lessonId);
  } catch (error) {
    if (
      error instanceof ConflictError ||
      error instanceof NotFoundError
    ) {
      // Locked lesson (ConflictError) or a NOT-enrolled actor (card S3-02
      // §6): the lesson page owns both states — go back to it. The slug
      // lookup above already ran, so a NotFoundError from the context load
      // can only be the not-enrolled/inconsistent case, never a bad slug.
      return { state: "kembali", href: lessonHref(courseSlug, lessonSlug) };
    }
    throw error;
  }
  const [settings, attempt] = await Promise.all([
    selectQuizSettings(db, target.quizId),
    selectAttemptByQuizAndUser(db, target.quizId, actor.id),
  ]);
  if (!settings) {
    // Unreachable with valid data (a lesson's quiz_id is a FK); defensive.
    throw new NotFoundError("Quiz tidak ditemukan.");
  }

  if (!attempt) {
    // No attempt yet — only now does the video gate apply. An existing
    // attempt outranks it (owner review of PR 138): the ≥ 90 %
    // requirement guards the FIRST start, so a READY video attached
    // after the quiz was done never sends a finished participant back
    // to the lesson page.
    if (!context.eligible) {
      return {
        state: "kembali",
        href: lessonHref(context.courseSlug, context.lessonSlug),
      };
    }
    const questionRows = await selectQuizQuestions(db, target.quizId);
    return toQuizRulesDTO({
      lessonId: target.lessonId,
      lessonPosition: context.lessonPosition,
      lessonTitle: target.lessonTitle,
      settings,
      questionRows,
      lessonHref: lessonHref(context.courseSlug, context.lessonSlug),
    });
  }

  const now = new Date();
  if (attempt.status === "IN_PROGRESS") {
    if (!withinTolerance(now, attempt.expiresAt)) {
      // Decision 6: the GET does not write — the beacon submits this id.
      return { state: "kedaluwarsa", attemptId: attempt.id };
    }
    const [questionRows, optionRows, answerRows] = await Promise.all([
      selectQuizQuestions(db, attempt.quizId),
      selectQuizOptions(db, attempt.quizId),
      selectAttemptAnswers(db, attempt.id),
    ]);
    return toQuizRunningDTO({
      // Card S3-02 §1e: the runner's eyebrow h1 — same shape as the rules
      // screen's eyebrow ("Quiz Materi {posisi} · {judul materi}").
      heading: `Quiz Materi ${context.lessonPosition} · ${target.lessonTitle}`,
      attemptId: attempt.id,
      questionOrder: attempt.questionOrder,
      expiresAt: attempt.expiresAt,
      serverNow: now,
      settings,
      questionRows,
      optionRows,
      answerRows,
    });
  }

  // SUBMITTED / EXPIRED — the result screen. The option order is rebuilt
  // from the SAME seed as the running screen (decision 8), so review shows
  // exactly what the participant saw.
  const [questionRows, optionRows, answerRows] = await Promise.all([
    selectQuizQuestions(db, attempt.quizId),
    selectQuizOptions(db, attempt.quizId),
    selectAttemptAnswers(db, attempt.id),
  ]);
  return toQuizResultDTO({
    attempt,
    settings,
    questionRows,
    optionRows,
    answerRows,
    lesson: {
      position: context.lessonPosition,
      title: target.lessonTitle,
      href: lessonHref(context.courseSlug, context.lessonSlug),
    },
    next: context.next,
    finalQuizHref: context.finalQuizHref,
    finalQuizDone: context.finalQuizDone,
  });
}

/**
 * The Final Quiz page (card S5-02 §2) — a pure GET, the SAME state machine
 * as the lesson quiz page: not enrolled → `kembali` at the first lesson;
 * gate unmet without an attempt → `kembali` at the first incomplete lesson;
 * gate open without an attempt → `aturan-final` (the QZ-18 confirmation);
 * IN_PROGRESS inside the tolerance → `berjalan` (QuizRunner as-is); past it
 * → `kedaluwarsa` (the beacon submits); a final attempt → `hasil-final`.
 * An existing attempt OUTRANKS the gate (the S3-01 rule, FINAL included).
 */
export async function getFinalQuizPage(
  actor: SessionUser,
  courseSlug: string,
): Promise<FinalQuizPageDTO> {
  assertMemberRole(actor);
  const context = await loadFinalQuizContext(db, actor.id, { courseSlug });

  if (!context.enrolled) {
    return { state: "kembali", href: context.firstLessonHref };
  }
  const [settings, attempt] = await Promise.all([
    selectQuizSettings(db, context.quizId),
    selectAttemptByQuizAndUser(db, context.quizId, actor.id),
  ]);
  if (!settings) {
    // Unreachable with valid data (courses.final_quiz_id is a FK).
    throw new NotFoundError("Quiz tidak ditemukan.");
  }

  if (!attempt) {
    if (!context.allCompleted) {
      return { state: "kembali", href: context.firstIncompleteHref! };
    }
    const questionRows = await selectQuizQuestions(db, context.quizId);
    const weights = await getScoreWeights();
    const rules: FinalQuizRulesDTO = {
      state: "aturan-final",
      courseId: context.courseId,
      courseTitle: context.courseTitle,
      questionCount: questionRows.length,
      durationMinutes: settings.durationMinutes,
      passingScorePercent: settings.passingScorePercent,
      lessonAveragePercent: context.lessonAveragePercent,
      weights,
      lastLessonHref: context.lastLessonHref,
    };
    return rules;
  }

  const now = new Date();
  if (attempt.status === "IN_PROGRESS") {
    if (!withinTolerance(now, attempt.expiresAt)) {
      // Same decision-6 stance as the lesson quiz: the GET never writes.
      return { state: "kedaluwarsa", attemptId: attempt.id };
    }
    const [questionRows, optionRows, answerRows] = await Promise.all([
      selectQuizQuestions(db, attempt.quizId),
      selectQuizOptions(db, attempt.quizId),
      selectAttemptAnswers(db, attempt.id),
    ]);
    return toQuizRunningDTO({
      // Card S3-02 §1e: the Final runner's eyebrow h1.
      heading: `Final Quiz · ${context.courseTitle}`,
      attemptId: attempt.id,
      questionOrder: attempt.questionOrder,
      expiresAt: attempt.expiresAt,
      serverNow: now,
      settings,
      questionRows,
      optionRows,
      answerRows,
    });
  }

  // SUBMITTED / EXPIRED — the Final result screen: the shared review plus
  // the course card, read from the stored rows (finalScorePercent comes
  // from enrollments, never recomputed here).
  const [questionRows, optionRows, answerRows, enrollmentResult, weights] =
    await Promise.all([
      selectQuizQuestions(db, attempt.quizId),
      selectQuizOptions(db, attempt.quizId),
      selectAttemptAnswers(db, attempt.id),
      getEnrollmentFinalResult(db, actor.id, context.courseId),
      getScoreWeights(),
    ]);
  if (!enrollmentResult) {
    // Unreachable: a final attempt implies the submit wrote the enrollment.
    throw new Error("attempt service: final result without an enrollment row");
  }
  return toFinalQuizResultDTO({
    attempt,
    settings,
    questionRows,
    optionRows,
    answerRows,
    final: {
      durationLimitSeconds: settings.durationMinutes * 60,
      passingScorePercent: settings.passingScorePercent,
      lessonAveragePercent: context.lessonAveragePercent,
      weights,
      finalScorePercent: enrollmentResult.finalScorePercent,
      courseStatus:
        enrollmentResult.status === "PASSED" ? "PASSED" : "COMPLETED",
    },
  });
}

// --------------------------------------------------------------------- start

/**
 * Steps 3–6 of BOTH starts (card S5-02 §2, extracted verbatim from
 * startLessonQuiz): settings + questions, the shuffle, the attempt number,
 * the guarded insert — and the suppressed-insert fallback to the winner's
 * live row. Same transaction as the caller's gate checks.
 */
async function insertAttemptInTx(
  tx: DbTx,
  input: { quizId: string; actorId: string; enrollmentId: string },
): Promise<{ attemptId: string; created: boolean }> {
  const [settings, questionRows] = await Promise.all([
    selectQuizSettings(tx, input.quizId),
    selectQuizQuestions(tx, input.quizId),
  ]);
  if (!settings) {
    throw new NotFoundError("Quiz tidak ditemukan.");
  }
  if (questionRows.length === 0) {
    // Defensive: the CMS requires questions before publish; a hand-made
    // start on an empty quiz still answers 409, never a 0-question run.
    throw new ConflictError("Quiz ini belum bisa dikerjakan.");
  }

  const orderedIds = questionRows.map((row) => row.id);
  const questionOrder = settings.shuffleQuestions
    ? shuffleQuestionIds(orderedIds)
    : orderedIds;
  const attemptNumber = await selectNextAttemptNumber(
    tx,
    input.quizId,
    input.actorId,
  );
  const startedAt = new Date();
  const expiresAt = new Date(
    startedAt.getTime() + settings.durationMinutes * 60_000,
  );

  const insertedId = await insertAttempt(tx, {
    quizId: input.quizId,
    userId: input.actorId,
    enrollmentId: input.enrollmentId,
    attemptNumber,
    questionOrder,
    startedAt,
    expiresAt,
  });
  if (insertedId !== undefined) {
    return { attemptId: insertedId, created: true };
  }
  // The index suppressed us — the winner's row IS the same quiz for the
  // same participant; select it back and continue their attempt.
  const winner = await selectAttemptByQuizAndUser(
    tx,
    input.quizId,
    input.actorId,
  );
  if (!winner || winner.status !== "IN_PROGRESS") {
    // Unreachable: the partial index only suppresses IN_PROGRESS rows.
    throw new Error("attempt service: suppressed insert without a live attempt");
  }
  return { attemptId: winner.id, created: false };
}

/**
 * "Mulai quiz" (card §1) — ONE transaction, no SELECT … FOR UPDATE: the
 * `one_active_attempt` partial unique index is the guard, so a double-click
 * race ends with ONE attempt row and `created: false` for the loser
 * (QZ-08: a refresh continues the same attempt, never a second one).
 */
export async function startLessonQuiz(
  actor: SessionUser,
  input: StartQuizInput,
): Promise<{ attemptId: string; created: boolean }> {
  assertMemberRole(actor);
  return db.transaction(async (tx) => {
    const context = await loadLessonQuizContext(tx, actor.id, input.lessonId);
    if (context.quizId === null) {
      // Defensive: the start button never renders for a lesson without a
      // quiz; a hand-made POST still answers a 404, not a crash.
      throw new NotFoundError("Quiz tidak ditemukan.");
    }

    const existing = await selectAttemptByQuizAndUser(
      tx,
      context.quizId,
      actor.id,
    );
    if (existing) {
      if (existing.status === "IN_PROGRESS") {
        // Refresh mid-quiz continues THE attempt (QZ-08).
        return { attemptId: existing.id, created: false };
      }
      // One attempt per quiz, forever (until an admin reset, QZ-19).
      throw new ConflictError("Quiz ini sudah dikerjakan.");
    }
    // No attempt yet — the video gate guards the FIRST start only, so an
    // existing attempt above outranks it (owner review of PR 138; a
    // READY video attached after submitting must not resurrect the gate).
    if (!context.eligible) {
      throw new ConflictError(
        "Tonton video sampai minimal 90 % untuk membuka quiz.",
      );
    }

    return insertAttemptInTx(tx, {
      quizId: context.quizId,
      actorId: actor.id,
      enrollmentId: context.enrollmentId,
    });
  });
}

// ---------------------------------------------------------- S5-02 final quiz

/**
 * "Mulai Final Quiz" (card S5-02 §2) — ONE transaction, statement order:
 * context (not enrolled reads exactly like an unknown course → the SAME
 * 404) → an existing attempt (IN_PROGRESS continues it, a final one is the
 * one-attempt 409 — an attempt OUTRANKS the gate) → the all-lessons gate
 * (409 with the way-back message) → the shared insert. No FOR UPDATE, same
 * partial-index guard as the lesson start.
 */
export async function startFinalQuiz(
  actor: SessionUser,
  input: StartFinalQuizInput,
): Promise<{ attemptId: string; created: boolean }> {
  assertMemberRole(actor);
  return db.transaction(async (tx) => {
    const context = await loadFinalQuizContext(tx, actor.id, {
      courseId: input.courseId,
    });
    if (!context.enrolled) {
      throw new NotFoundError("Kursus tidak ditemukan.");
    }

    const existing = await selectAttemptByQuizAndUser(
      tx,
      context.quizId,
      actor.id,
    );
    if (existing) {
      if (existing.status === "IN_PROGRESS") {
        // Refresh mid-Final continues THE attempt (QZ-08/QZ-13).
        return { attemptId: existing.id, created: false };
      }
      // One attempt forever, FINAL included (QZ-13).
      throw new ConflictError("Final Quiz ini sudah dikerjakan.");
    }
    if (!context.allCompleted) {
      throw new ConflictError(
        "Selesaikan semua materi untuk membuka Final Quiz.",
      );
    }

    return insertAttemptInTx(tx, {
      quizId: context.quizId,
      actorId: actor.id,
      enrollmentId: context.enrollmentId,
    });
  });
}

// ----------------------------------------------------------------- save

/**
 * Auto-save (card §1, QZ-09) — ONE transaction, lock FIRST: FOR UPDATE the
 * attempt row (ownership in the WHERE), THEN read status/timing from the
 * locked row, then validate question+option membership, then upsert.
 * is_correct is never read or written here (V-01).
 */
export async function saveQuizAnswer(
  actor: SessionUser,
  input: SaveQuizAnswerInput,
): Promise<{ savedAt: string }> {
  assertMemberRole(actor);
  return db.transaction(async (tx) => {
    const attempt = await findAttemptForUpdate(tx, input.attemptId, actor.id);
    if (!attempt) {
      throw new NotFoundError("Quiz tidak ditemukan.");
    }
    if (attempt.status !== "IN_PROGRESS") {
      throw new ConflictError("Quiz ini sudah selesai.");
    }
    const now = new Date();
    if (!withinTolerance(now, attempt.expiresAt)) {
      throw new ConflictError("Waktu quiz sudah habis.");
    }
    if (!attempt.questionOrder.includes(input.questionId)) {
      throw new NotFoundError("Soal tidak ditemukan.");
    }
    const belongs = await selectOptionBelongsToQuestion(
      tx,
      input.questionId,
      input.optionId,
    );
    if (!belongs) {
      // Same message as the question miss — ids cannot be probed.
      throw new NotFoundError("Soal tidak ditemukan.");
    }
    await upsertQuizAnswer(tx, {
      attemptId: attempt.id,
      questionId: input.questionId,
      selectedOptionId: input.optionId,
      answeredAt: now,
    });
    return { savedAt: now.toISOString() };
  });
}

// ------------------------------------------------------------------- submit

/**
 * "Kumpulkan" (card §1 + card S5-02 §2) — ONE transaction, lock FIRST,
 * idempotent. An already-final attempt returns its stored status WITHOUT
 * regrading. The verdict follows the 15-second tolerance (decision 7):
 * inside it → SUBMITTED, past it → EXPIRED (time spent still caps at
 * expires_at). Grading is separate statements in a fixed order: questions
 * (order + points), answers (selected), options (is_correct) — then the
 * attempt row, then each answer's grade, then the recorder, all on the
 * SAME transaction. The recorder itself branches on quizzes.type INSIDE
 * the transaction: LESSON → lesson_progress (getScoreWeights is never
 * called); FINAL → enrollments via recordFinalQuizResult.
 *
 * The score weights are read BEFORE the transaction (owner addition,
 * S5-02): getScoreWeights queries through `db`, and awaiting a `db` query
 * inside db.transaction deadlocks on PGlite. A plain pre-read (quiz type +
 * the actor's attempt status, no lock) decides whether they are needed; a
 * FINAL attempt that is already final never reads them (idempotent path),
 * and a missing attempt changes nothing — the transaction still answers
 * the one 404. Invalid weights throw HERE, so nothing is written and the
 * attempt stays IN_PROGRESS.
 */
export async function submitQuizAttempt(
  actor: SessionUser,
  input: SubmitQuizInput,
): Promise<{ status: "SUBMITTED" | "EXPIRED" }> {
  assertMemberRole(actor);
  const preread = await selectSubmitPreread(input.attemptId, actor.id);
  let weights: ScoreWeights | undefined;
  if (
    preread !== undefined &&
    preread.quizType === "FINAL" &&
    preread.status === "IN_PROGRESS"
  ) {
    weights = await getScoreWeights();
  }

  return db.transaction(async (tx) => {
    const attempt = await findAttemptForUpdate(tx, input.attemptId, actor.id);
    if (!attempt) {
      throw new NotFoundError("Quiz tidak ditemukan.");
    }
    if (attempt.status !== "IN_PROGRESS") {
      // Already final (this request or a concurrent one that won the lock):
      // stored status, no regrade, no weights needed.
      return { status: attempt.status };
    }

    const now = new Date();
    const status = withinTolerance(now, attempt.expiresAt)
      ? ("SUBMITTED" as const)
      : ("EXPIRED" as const);

    const [settings, questionRows, optionRows, answerRows] = await Promise.all([
      selectQuizSettings(tx, attempt.quizId),
      selectQuizQuestions(tx, attempt.quizId),
      selectQuizOptions(tx, attempt.quizId),
      selectAttemptAnswers(tx, attempt.id),
    ]);
    if (!settings) {
      throw new Error("attempt service: submit without a quiz settings row");
    }
    const selectedByQuestion = new Map(
      answerRows.map((row) => [row.questionId, row.selectedOptionId]),
    );
    const correctByOption = new Map(
      optionRows.map((row) => [row.id, row.isCorrect]),
    );

    let score = 0;
    // max_score counts EVERY question of the locked question_order —
    // unanswered ones are wrong at 0 points, not excluded (card mutation 7).
    let maxScore = 0;
    for (const questionId of attempt.questionOrder) {
      const question = questionRows.find((row) => row.id === questionId);
      if (!question) {
        // Unreachable with valid data (question_order is locked at start).
        throw new Error("attempt service: question_order without a row");
      }
      maxScore += question.points;
      const selected = selectedByQuestion.get(questionId);
      if (selected === undefined || selected === null) {
        continue;
      }
      if (correctByOption.get(selected) === true) {
        score += question.points;
      }
    }

    const scorePercent =
      maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
    const isPassed = scorePercent >= settings.passingScorePercent;

    await finalizeAttempt(tx, {
      attemptId: attempt.id,
      status,
      score,
      maxScore,
      scorePercent,
      isPassed,
      submittedAt: now,
    });
    for (const row of answerRows) {
      if (row.selectedOptionId === null) continue;
      await setAnswerGrade(tx, {
        attemptId: attempt.id,
        questionId: row.questionId,
        isCorrect: correctByOption.get(row.selectedOptionId) === true,
        pointsEarned:
          correctByOption.get(row.selectedOptionId) === true
            ? (questionRows.find((q) => q.id === row.questionId)?.points ?? 0)
            : 0,
      });
    }

    if (settings.type === "FINAL") {
      // Nilai Akhir lands on enrollments, same transaction (PRG-05): a
      // weights failure above rolled everything back before any write; a
      // missing weights here is unreachable (the pre-read saw IN_PROGRESS,
      // and the idempotent guard returned otherwise).
      const courseId = await selectCourseIdByFinalQuizId(tx, attempt.quizId);
      if (courseId === undefined) {
        throw new Error("attempt service: FINAL quiz without a course row");
      }
      if (weights === undefined) {
        throw new Error("attempt service: FINAL submit without score weights");
      }
      await recordFinalQuizResult(tx, {
        actorId: actor.id,
        courseId,
        enrollmentId: attempt.enrollmentId,
        finalScorePercent: scorePercent,
        isPassed,
        weights,
        submittedAt: now,
      });
      return { status };
    }

    const lessonId = await selectLessonIdByQuizId(tx, attempt.quizId);
    if (!lessonId) {
      throw new Error("attempt service: submit without a lesson row");
    }
    await recordLessonQuizResult(tx, {
      actorId: actor.id,
      lessonId,
      enrollmentId: attempt.enrollmentId,
      scorePercent,
      isPassed,
      submittedAt: now,
    });
    return { status };
  });
}
