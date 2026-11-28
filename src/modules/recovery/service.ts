// Service layer for the recovery module (card S3-03 §2) — the ONLY surface
// other modules may import. Two audiences:
// - participant (MEMBER+): the report page state machine + "Kirim laporan";
// - staff (ADMIN+, role checked BEFORE any input is parsed): the queue, the
//   review, approve/reject, and the manual reset (decision 8).
// Every reset — approved report or manual — goes through resetAttemptInTx
// (one door). All reads inside a transaction run on `tx`: awaiting a `db`
// query inside db.transaction deadlocks on PGlite (STATUS 19 Nov no. 4).
import { z } from "zod";

import { db } from "@/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { SessionUser } from "@/lib/rbac";
import { normalizeEmail } from "@/modules/auth/schema";
import { UUID_PATTERN } from "@/modules/course/schema";
import {
  finalQuizHref,
  loadFinalQuizContext,
  loadLessonQuizContext,
  quizHref,
  revertFinalQuizResult,
  revertLessonQuizResult,
} from "@/modules/progress/service";

import { assertAdminRole, assertMemberRole } from "./policy";
import {
  countAnsweredAnswers,
  insertAuditLog,
  insertReport,
  liveFinalAttemptExists,
  lockAttemptForReset,
  lockOwnedAttempt,
  lockPendingReportByAttempt,
  lockReportByNumber,
  markAttemptReset,
  markReportDecided,
  quizHasResetRow,
  selectActorQuizAttempts,
  selectActorReports,
  selectAnswerTimes,
  selectPendingReportsOfUser,
  selectPublishedLessonBySlugs,
  selectQuizScope,
  selectReportCounts,
  selectReportQueue,
  selectReportReview,
  selectUserAttempts,
  selectUserByEmail,
  type DbTx,
} from "./queries";
import {
  createReportInput,
  decideReportInput,
  findUserInput,
  listReportsInput,
  manualResetInput,
} from "./schema";
import {
  toManualQuizItems,
  toReportAlreadyResetDTO,
  toReportApprovedDTO,
  toReportFormDTO,
  toReportPendingDTO,
  toReportQueueItemDTO,
  toReportRejectedDTO,
  toReportReviewDTO,
  type AttemptReportPageDTO,
  type ManualQuizItemDTO,
  type ManualResetLookupDTO,
  type ReportQueueDTO,
  type ReportQueueItemDTO,
  type ReportQuizContext,
  type ReportReviewDTO,
  type TimelineEntryDTO,
} from "./serializer";

export type {
  AttemptReportPageDTO,
  ManualQuizItemDTO,
  ManualResetLookupDTO,
  ReportQueueDTO,
  ReportQueueItemDTO,
  ReportReviewDTO,
  TimelineEntryDTO,
};
export type {
  ReportAlreadyResetDTO,
  ReportApprovedDTO,
  ReportFormDTO,
  ReportPendingDTO,
  ReportRejectedDTO,
} from "./serializer";

/** The Kursus page of the progress module (S5-04 route `/belajar/{slug}`). */
function courseHref(courseSlug: string): string {
  return `/belajar/${courseSlug}`;
}

const reportNumberInput = z.number().int().positive().max(2_147_483_647);

/** Copy of the participant-facing 409s (usulan, listed in the PR). */
const ALREADY_RESET = "Quiz ini sudah pernah direset.";

// ------------------------------------------------------------ participant

export type ReportTarget =
  | { kind: "LESSON"; courseSlug: string; lessonSlug: string }
  | { kind: "FINAL"; courseSlug: string };

/**
 * The report page (card §2) — a pure GET. Order: quiz resolution through
 * the SAME context as the quiz page (miss → uniform NotFoundError; a locked
 * lesson or an unenrolled Final → back to the quiz page, which owns those
 * states); then the state machine:
 * 1. live attempt with a report: PENDING → menunggu, REJECTED → ditolak;
 * 2. quiz reset before: live missing/IN_PROGRESS + latest report APPROVED →
 *    disetujui; live finished → sudah-direset; else → quiz page;
 * 3. live finished without a report → form; 4. else → quiz page.
 */
export async function getAttemptReportPage(
  actor: SessionUser,
  target: ReportTarget,
): Promise<AttemptReportPageDTO | { redirect: string }> {
  assertMemberRole(actor);

  let quizId: string;
  let context: ReportQuizContext;
  if (target.kind === "LESSON") {
    const lesson = await selectPublishedLessonBySlugs(
      target.courseSlug,
      target.lessonSlug,
    );
    if (!lesson || lesson.quizId === null) {
      throw new NotFoundError("Quiz tidak ditemukan.");
    }
    const href = quizHref(target.courseSlug, target.lessonSlug);
    let lessonContext;
    try {
      lessonContext = await loadLessonQuizContext(db, actor.id, lesson.lessonId);
    } catch (error) {
      // Locked lesson (409) or not enrolled (404): the quiz page redirects
      // to the lesson page, which renders both properly.
      if (error instanceof ConflictError || error instanceof NotFoundError) {
        return { redirect: href };
      }
      throw error;
    }
    quizId = lesson.quizId;
    context = {
      kind: "LESSON",
      lessonPosition: lessonContext.lessonPosition,
      quizHref: href,
      courseHref: courseHref(target.courseSlug),
      nextLesson: lessonContext.next,
    };
  } else {
    const finalContext = await loadFinalQuizContext(db, actor.id, {
      courseSlug: target.courseSlug,
    });
    const href = finalQuizHref(target.courseSlug);
    if (!finalContext.enrolled) return { redirect: href };
    quizId = finalContext.quizId;
    context = {
      kind: "FINAL",
      lessonPosition: null,
      quizHref: href,
      courseHref: courseHref(target.courseSlug),
      nextLesson: null,
    };
  }

  const attempts = await selectActorQuizAttempts(quizId, actor.id);
  const live = attempts.find((row) => row.resetAt === null) ?? null;
  const wasReset = attempts.some((row) => row.resetAt !== null);
  const reports = await selectActorReports(
    attempts.map((row) => row.id),
    actor.id,
  );
  const liveReport = live
    ? (reports.find((report) => report.attemptId === live.id) ?? null)
    : null;
  const liveFinished = live !== null && live.status !== "IN_PROGRESS";

  if (live && liveReport) {
    if (liveReport.status === "PENDING") {
      return toReportPendingDTO({ context, attempt: live, report: liveReport });
    }
    if (liveReport.status === "REJECTED") {
      return toReportRejectedDTO({ context, attempt: live, report: liveReport });
    }
  }
  if (wasReset) {
    if (!liveFinished) {
      const latest = reports[0];
      if (latest && latest.status === "APPROVED") {
        return toReportApprovedDTO({ context, report: latest });
      }
      // A manual reset without a report, not redone yet.
      return { redirect: context.quizHref };
    }
    return toReportAlreadyResetDTO(context);
  }
  if (live && liveFinished) {
    const answered = await countAnsweredAnswers(live.id);
    return toReportFormDTO({ context, attempt: live, answered });
  }
  return { redirect: context.quizHref };
}

/**
 * "Kirim laporan" (card §2) — ONE transaction. Order (owner decision):
 * ownership (uniform 404) → the attempt was reset (409) → still running
 * (409) → the quiz was reset before (409, decision 4) → a second report
 * (409; UNIQUE(attempt_id) is the race guard). user_id comes from the
 * locked attempt row.
 */
export async function createAttemptReport(
  actor: SessionUser,
  attemptId: string,
  input: unknown,
): Promise<{ number: number }> {
  assertMemberRole(actor);
  const parsed = createReportInput.parse(input);
  if (!UUID_PATTERN.test(attemptId)) {
    throw new NotFoundError("Quiz tidak ditemukan.");
  }
  return db.transaction(async (tx) => {
    const attempt = await lockOwnedAttempt(tx, attemptId, actor.id);
    if (!attempt) throw new NotFoundError("Quiz tidak ditemukan.");
    if (attempt.resetAt !== null) throw new ConflictError(ALREADY_RESET);
    if (attempt.status === "IN_PROGRESS") {
      throw new ConflictError("Quiz ini belum selesai.");
    }
    if (await quizHasResetRow(tx, attempt.quizId, attempt.userId)) {
      throw new ConflictError(ALREADY_RESET);
    }
    const number = await insertReport(tx, {
      ...parsed,
      attemptId: attempt.id,
      userId: attempt.userId,
    });
    if (number === undefined) {
      throw new ConflictError("Attempt ini sudah dilaporkan.");
    }
    return { number };
  });
}

// ------------------------------------------------------------------ staff

/** The queue (26a): counts per status + one tab's rows (≤ 50). */
export async function listAttemptReports(
  actor: SessionUser,
  input: unknown,
  now: Date = new Date(),
): Promise<ReportQueueDTO> {
  assertAdminRole(actor);
  const { status } = listReportsInput.parse(input);
  const [counts, rows] = await Promise.all([
    selectReportCounts(),
    selectReportQueue(status),
  ]);
  return {
    counts,
    items: rows.map((row) => toReportQueueItemDTO(row, now)),
  };
}

/** The review page (26b); unknown number → 404. */
export async function getAttemptReportReview(
  actor: SessionUser,
  number: unknown,
  now: Date = new Date(),
): Promise<ReportReviewDTO> {
  assertAdminRole(actor);
  const parsed = reportNumberInput.parse(number);
  const row = await selectReportReview(parsed);
  if (!row) throw new NotFoundError("Laporan tidak ditemukan.");
  const answers = await selectAnswerTimes(row.attemptId, row.attemptQuestionOrder);
  return toReportReviewDTO({ row, answers, now });
}

/**
 * THE reset (decision 2), shared by both staff paths. Lock order: the
 * caller already holds the report lock (if any); here the attempt row is
 * locked FOR UPDATE, then — reading only through `tx` — the guards run:
 * already reset (409), quiz reset before (409, decision 4), lesson quiz
 * whose course Final has a live attempt (409, decision 3). Writes: the
 * attempt's reset_* (+ IN_PROGRESS → EXPIRED so `one_active_attempt` frees
 * up), the progress revert, and ONE `attempt.reset` audit row.
 */
async function resetAttemptInTx(
  tx: DbTx,
  input: {
    actorId: string;
    attemptId: string;
    reason: string;
    internalNote: string | null;
    reportNumber: number | null;
  },
): Promise<void> {
  const attempt = await lockAttemptForReset(tx, input.attemptId);
  if (!attempt) throw new NotFoundError("Attempt tidak ditemukan.");
  if (attempt.resetAt !== null) {
    throw new ConflictError("Attempt ini sudah pernah direset.");
  }
  if (await quizHasResetRow(tx, attempt.quizId, attempt.userId)) {
    throw new ConflictError(ALREADY_RESET);
  }
  const scope = await selectQuizScope(tx, attempt.quizId);
  if (!scope || scope.courseId === null) {
    throw new Error("recovery service: quiz without a course");
  }
  if (scope.kind === "LESSON") {
    if (scope.lessonId === null) {
      throw new Error("recovery service: lesson quiz without a lesson");
    }
    if (await liveFinalAttemptExists(tx, scope.courseId, attempt.userId)) {
      throw new ConflictError(
        "Final Quiz kursus ini sudah dimulai. Reset Final Quiz dulu lewat Reset tanpa laporan, lalu putuskan laporan ini.",
      );
    }
  }

  const resetAt = new Date();
  const newStatus = attempt.status === "IN_PROGRESS" ? "EXPIRED" : attempt.status;
  await markAttemptReset(tx, {
    attemptId: attempt.id,
    status: newStatus,
    resetBy: input.actorId,
    resetReason: input.reason,
    resetAt,
  });
  if (scope.kind === "LESSON") {
    await revertLessonQuizResult(tx, {
      userId: attempt.userId,
      lessonId: scope.lessonId!,
    });
  } else {
    await revertFinalQuizResult(tx, {
      userId: attempt.userId,
      courseId: scope.courseId,
    });
  }
  await insertAuditLog(tx, {
    actorId: input.actorId,
    action: "attempt.reset",
    entityType: "quiz_attempt",
    entityId: attempt.id,
    before: {
      userId: attempt.userId,
      quizType: scope.kind,
      status: attempt.status,
      scorePercent: attempt.scorePercent,
      isPassed: attempt.isPassed,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      resetAt: null,
    },
    after: {
      status: newStatus,
      resetAt: resetAt.toISOString(),
      resetReason: input.reason,
      internalNote: input.internalNote,
      reportNumber: input.reportNumber,
    },
  });
}

/**
 * Approve or reject a PENDING report (26b) — ONE transaction, the report
 * locked FOR UPDATE first. APPROVE = resetAttemptInTx + report APPROVED;
 * REJECT = report REJECTED + `attempt_report.reject` audit, attempt
 * untouched. Already decided → 409.
 */
export async function decideAttemptReport(
  actor: SessionUser,
  number: unknown,
  input: unknown,
): Promise<{ status: "APPROVED" | "REJECTED" }> {
  assertAdminRole(actor);
  const reportNumber = reportNumberInput.parse(number);
  const parsed = decideReportInput.parse(input);
  const internalNote = parsed.internalNote ?? null;
  return db.transaction(async (tx) => {
    const report = await lockReportByNumber(tx, reportNumber);
    if (!report) throw new NotFoundError("Laporan tidak ditemukan.");
    if (report.status !== "PENDING") {
      throw new ConflictError("Laporan ini sudah diputuskan.");
    }
    const decidedAt = new Date();
    if (parsed.decision === "APPROVE") {
      await resetAttemptInTx(tx, {
        actorId: actor.id,
        attemptId: report.attemptId,
        reason: parsed.reason,
        internalNote,
        reportNumber: report.number,
      });
      await markReportDecided(tx, {
        reportId: report.id,
        status: "APPROVED",
        decisionReason: parsed.reason,
        internalNote,
        decidedBy: actor.id,
        decidedAt,
      });
      return { status: "APPROVED" as const };
    }
    await markReportDecided(tx, {
      reportId: report.id,
      status: "REJECTED",
      decisionReason: parsed.reason,
      internalNote,
      decidedBy: actor.id,
      decidedAt,
    });
    await insertAuditLog(tx, {
      actorId: actor.id,
      action: "attempt_report.reject",
      entityType: "quiz_attempt_report",
      entityId: report.id,
      before: { reportNumber: report.number, status: "PENDING" },
      after: {
        reportNumber: report.number,
        status: "REJECTED",
        decisionReason: parsed.reason,
        internalNote,
      },
    });
    return { status: "REJECTED" as const };
  });
}

/** Manual reset lookup (26c): exact (normalized) email, not deleted. */
export async function findUserForManualReset(
  actor: SessionUser,
  input: unknown,
): Promise<ManualResetLookupDTO> {
  assertAdminRole(actor);
  const { email } = findUserInput.parse(input);
  const normalized = normalizeEmail(email);
  const user = await selectUserByEmail(normalized);
  if (!user) return { found: false, email: normalized };
  const [rows, pending] = await Promise.all([
    selectUserAttempts(user.id),
    selectPendingReportsOfUser(user.id),
  ]);
  return {
    found: true,
    email: normalized,
    user: { name: user.name, email: user.email },
    quizzes: toManualQuizItems({
      rows,
      pendingByAttempt: new Map(pending.map((row) => [row.attemptId, row.number])),
    }),
  };
}

/**
 * Reset without a report (26c, decision 8) — ONE transaction. The
 * attempt's PENDING report (if any) is locked FIRST (same lock order as a
 * decision), then resetAttemptInTx, then that report is closed APPROVED
 * with the same reason so the participant still gets an answer.
 */
export async function resetAttemptManually(
  actor: SessionUser,
  attemptId: string,
  input: unknown,
): Promise<{ attemptId: string }> {
  assertAdminRole(actor);
  const parsed = manualResetInput.parse(input);
  if (!UUID_PATTERN.test(attemptId)) {
    throw new NotFoundError("Attempt tidak ditemukan.");
  }
  const internalNote = parsed.internalNote ?? null;
  return db.transaction(async (tx) => {
    const pending = await lockPendingReportByAttempt(tx, attemptId);
    await resetAttemptInTx(tx, {
      actorId: actor.id,
      attemptId,
      reason: parsed.reason,
      internalNote,
      reportNumber: pending?.number ?? null,
    });
    if (pending) {
      await markReportDecided(tx, {
        reportId: pending.id,
        status: "APPROVED",
        decisionReason: parsed.reason,
        internalNote,
        decidedBy: actor.id,
        decidedAt: new Date(),
      });
    }
    return { attemptId };
  });
}
