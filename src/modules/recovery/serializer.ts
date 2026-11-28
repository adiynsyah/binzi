// Explicit serialization for the recovery module (card S3-03 §2). ONE DTO
// per audience: the participant DTOs never carry internal_note, decided_by,
// an admin id, reset_by, or another attempt's id (serializer.test.ts checks
// the Object.keys allowlist per state); the staff DTOs are separate types.
//
// Pure on purpose — no runtime db import — so the serializer tests run
// without a database. Every date is formatted HERE, on the server (WIB).
import { formatWib, formatWibDate } from "@/lib/datetime";

import { REPORT_DEADLINE_HOURS, REPORT_URGENT_HOURS } from "./policy";
import {
  REPORT_CATEGORY_LABELS,
  type ReportCategory,
  type ReportStatus,
} from "./schema";

export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
export type QuizKind = "LESSON" | "FINAL";

const HOUR_MS = 3_600_000;

// ------------------------------------------------------------------ helpers

/** "09:14" — minutes zero-padded and unbounded, seconds zero-padded. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** "14.02.11" — WIB time with seconds for the system-note timeline. */
export function formatWibTime(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/**
 * Time left on the clock when the attempt stopped: EXPIRED → 00:00 (the
 * clock ran out by definition); SUBMITTED → expires_at − submitted_at,
 * never negative (the 15-second tolerance can land after expires_at).
 */
export function remainingAtStop(attempt: {
  status: AttemptStatus;
  expiresAt: Date;
  submittedAt: Date | null;
}): string {
  if (attempt.status !== "SUBMITTED" || attempt.submittedAt === null) {
    return formatClock(0);
  }
  return formatClock(
    (attempt.expiresAt.getTime() - attempt.submittedAt.getTime()) / 1000,
  );
}

/** "Terhenti di soal {n}": the first unsaved question, capped at total. */
export function stoppedAtQuestion(answered: number, total: number): number {
  return Math.min(answered + 1, total);
}

/** Stored NUMERIC → the floored display score (S3-01/S5-03 rule). */
export function displayScore(scorePercent: string | null): number {
  return Math.floor(Number(scorePercent ?? 0));
}

export type DeadlineDTO = { label: string; urgent: boolean };

/** Whole hours, rounded DOWN; under one hour reads "< 1". */
function hoursLabel(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  return hours < 1 ? "< 1" : String(hours);
}

/**
 * Decision 9: the deadline is created_at + 24 calendar hours. "sisa {j}
 * jam" / "lewat {j} jam" with hours rounded DOWN (so "sisa 5 jam" is the
 * first red label and "sisa 6 jam" never shows in both colours); red
 * (`urgent`) when fewer than 6 hours remain or the deadline has passed.
 */
export function toDeadline(createdAt: Date, now: Date): DeadlineDTO {
  const dueAt = createdAt.getTime() + REPORT_DEADLINE_HOURS * HOUR_MS;
  const remainingMs = dueAt - now.getTime();
  if (remainingMs <= 0) {
    return { label: `lewat ${hoursLabel(-remainingMs)} jam`, urgent: true };
  }
  return {
    label: `sisa ${hoursLabel(remainingMs)} jam`,
    urgent: remainingMs < REPORT_URGENT_HOURS * HOUR_MS,
  };
}

/** The deadline DATE the participant sees ("perkiraan selesai {tanggal}"). */
export function deadlineDate(createdAt: Date): string {
  return formatWibDate(
    new Date(createdAt.getTime() + REPORT_DEADLINE_HOURS * HOUR_MS),
  );
}

/** "Materi 2" / "Final Quiz". */
export function scopeLabel(kind: QuizKind, lessonPosition: number | null): string {
  return kind === "FINAL" ? "Final Quiz" : `Materi ${lessonPosition ?? "–"}`;
}

/** "{kursus} · Materi 2" / "{kursus} · Final Quiz". */
export function quizLabel(
  courseTitle: string,
  kind: QuizKind,
  lessonPosition: number | null,
): string {
  return `${courseTitle} · ${scopeLabel(kind, lessonPosition)}`;
}

/** The participant eyebrow's first half ("Quiz materi 2" / "Final Quiz"). */
export function quizEyebrow(kind: QuizKind, lessonPosition: number | null): string {
  return kind === "FINAL" ? "Final Quiz" : `Quiz materi ${lessonPosition ?? "–"}`;
}

// ------------------------------------------------------- participant DTOs

export type ReportFormDTO = {
  state: "form";
  eyebrow: string;
  kind: QuizKind;
  /** The participant's OWN live attempt — the POST target. */
  attemptId: string;
  /** "Batal" goes back to the quiz page (its result screen). */
  quizHref: string;
  summary: {
    attemptNumber: number;
    scope: string;
    startedAt: string;
    stoppedAt: number;
    total: number;
    remaining: string;
    answered: number;
  };
};

export type ReportPendingDTO = {
  state: "menunggu";
  eyebrow: string;
  kind: QuizKind;
  lessonPosition: number | null;
  number: number;
  createdAt: string;
  deadlineDate: string;
  scorePercent: number;
  /** The next lesson while waiting; null on the last lesson and the Final. */
  nextLesson: { position: number; href: string } | null;
  courseHref: string;
};

export type ReportApprovedDTO = {
  state: "disetujui";
  eyebrow: string;
  kind: QuizKind;
  lessonPosition: number | null;
  decisionReason: string;
  decidedAt: string;
  quizHref: string;
};

export type ReportRejectedDTO = {
  state: "ditolak";
  eyebrow: string;
  scorePercent: number;
  decisionReason: string;
  courseHref: string;
};

export type ReportAlreadyResetDTO = {
  state: "sudah-direset";
  eyebrow: string;
  courseHref: string;
};

export type AttemptReportPageDTO =
  | ReportFormDTO
  | ReportPendingDTO
  | ReportApprovedDTO
  | ReportRejectedDTO
  | ReportAlreadyResetDTO;

/** The quiz the report page is about (resolved by the service). */
export type ReportQuizContext = {
  kind: QuizKind;
  lessonPosition: number | null;
  quizHref: string;
  courseHref: string;
  nextLesson: { position: number; href: string } | null;
};

/** One quiz_attempts row as the participant page reads it. */
export type ParticipantAttemptRow = {
  id: string;
  attemptNumber: number;
  status: AttemptStatus;
  questionOrder: string[];
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  scorePercent: string | null;
  resetAt: Date | null;
};

/** One report row as the participant page reads it (no staff columns). */
export type ParticipantReportRow = {
  number: number;
  attemptId: string;
  status: ReportStatus;
  decisionReason: string | null;
  decidedAt: Date | null;
  createdAt: Date;
};

export function toReportFormDTO(input: {
  context: ReportQuizContext;
  attempt: ParticipantAttemptRow;
  answered: number;
}): ReportFormDTO {
  const { context, attempt } = input;
  const total = attempt.questionOrder.length;
  return {
    state: "form",
    eyebrow: quizEyebrow(context.kind, context.lessonPosition),
    kind: context.kind,
    attemptId: attempt.id,
    quizHref: context.quizHref,
    summary: {
      attemptNumber: attempt.attemptNumber,
      scope: scopeLabel(context.kind, context.lessonPosition),
      startedAt: formatWib(attempt.startedAt),
      stoppedAt: stoppedAtQuestion(input.answered, total),
      total,
      remaining: remainingAtStop(attempt),
      answered: input.answered,
    },
  };
}

export function toReportPendingDTO(input: {
  context: ReportQuizContext;
  attempt: ParticipantAttemptRow;
  report: ParticipantReportRow;
}): ReportPendingDTO {
  const { context, report } = input;
  return {
    state: "menunggu",
    eyebrow: quizEyebrow(context.kind, context.lessonPosition),
    kind: context.kind,
    lessonPosition: context.lessonPosition,
    number: report.number,
    createdAt: formatWib(report.createdAt),
    deadlineDate: deadlineDate(report.createdAt),
    scorePercent: displayScore(input.attempt.scorePercent),
    nextLesson: context.kind === "LESSON" ? context.nextLesson : null,
    courseHref: context.courseHref,
  };
}

export function toReportApprovedDTO(input: {
  context: ReportQuizContext;
  report: ParticipantReportRow;
}): ReportApprovedDTO {
  const { context, report } = input;
  if (report.decisionReason === null || report.decidedAt === null) {
    // Unreachable: the 0002 CHECKs require both on a decided report.
    throw new Error("recovery serializer: approved report without a decision");
  }
  return {
    state: "disetujui",
    eyebrow: quizEyebrow(context.kind, context.lessonPosition),
    kind: context.kind,
    lessonPosition: context.lessonPosition,
    decisionReason: report.decisionReason,
    decidedAt: formatWib(report.decidedAt),
    quizHref: context.quizHref,
  };
}

export function toReportRejectedDTO(input: {
  context: ReportQuizContext;
  attempt: ParticipantAttemptRow;
  report: ParticipantReportRow;
}): ReportRejectedDTO {
  const { context, report } = input;
  if (report.decisionReason === null) {
    throw new Error("recovery serializer: rejected report without a reason");
  }
  return {
    state: "ditolak",
    eyebrow: quizEyebrow(context.kind, context.lessonPosition),
    scorePercent: displayScore(input.attempt.scorePercent),
    decisionReason: report.decisionReason,
    courseHref: context.courseHref,
  };
}

export function toReportAlreadyResetDTO(
  context: ReportQuizContext,
): ReportAlreadyResetDTO {
  return {
    state: "sudah-direset",
    eyebrow: quizEyebrow(context.kind, context.lessonPosition),
    courseHref: context.courseHref,
  };
}

// ------------------------------------------------------------- staff DTOs

/** The quiz context columns every staff read selects (queries.ts). */
export type StaffAttemptContextRow = {
  attemptId: string;
  attemptNumber: number;
  attemptStatus: AttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  scorePercent: string | null;
  questionTotal: number;
  answered: number;
  quizKind: QuizKind;
  durationMinutes: number;
  courseTitle: string;
  /** null for a FINAL quiz. */
  lessonPosition: number | null;
};

export type ReportQueueRow = StaffAttemptContextRow & {
  number: number;
  status: ReportStatus;
  category: ReportCategory;
  createdAt: Date;
  reporterName: string;
};

export type ReportCountsDTO = {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  ALL: number;
};

export type ReportQueueItemDTO = {
  number: number;
  status: ReportStatus;
  reporterName: string;
  createdAt: string;
  quizLabel: string;
  scorePercent: number;
  answered: number;
  total: number;
  categoryLabel: string;
  /** null once decided (the column shows "—"). */
  deadline: DeadlineDTO | null;
};

export type ReportQueueDTO = {
  counts: ReportCountsDTO;
  items: ReportQueueItemDTO[];
};

export function toReportQueueItemDTO(
  row: ReportQueueRow,
  now: Date,
): ReportQueueItemDTO {
  return {
    number: row.number,
    status: row.status,
    reporterName: row.reporterName,
    createdAt: formatWib(row.createdAt),
    quizLabel: quizLabel(row.courseTitle, row.quizKind, row.lessonPosition),
    scorePercent: displayScore(row.scorePercent),
    answered: row.answered,
    total: row.questionTotal,
    categoryLabel: REPORT_CATEGORY_LABELS[row.category],
    deadline: row.status === "PENDING" ? toDeadline(row.createdAt, now) : null,
  };
}

export type ReportReviewRow = ReportQueueRow & {
  description: string;
  reporterEmail: string;
  reporterOrdinal: number;
  decisionReason: string | null;
  internalNote: string | null;
  decidedAt: Date | null;
  decidedByName: string | null;
};

/** One saved answer's timestamp + its position in question_order. */
export type AnswerTimeRow = { position: number; answeredAt: Date };

export type TimelineEntryDTO = {
  time: string;
  label: string;
  tone: "neutral" | "success";
};

export type ReportReviewDTO = {
  number: number;
  status: ReportStatus;
  deadline: DeadlineDTO | null;
  reporter: { name: string; email: string; ordinal: number };
  createdAt: string;
  categoryLabel: string;
  description: string;
  attempt: {
    attemptNumber: number;
    kind: QuizKind;
    lessonPosition: number | null;
    contextLine: string;
    scorePercent: number;
    remaining: string;
    answered: number;
    total: number;
  };
  timeline: TimelineEntryDTO[];
  decision: {
    status: "APPROVED" | "REJECTED";
    reason: string;
    internalNote: string | null;
    decidedByName: string | null;
    decidedAt: string;
  } | null;
};

/**
 * Decision 7: the "catatan sistem" is built ONLY from rows in the
 * database — started_at, each saved answer's answered_at (position from
 * question_order), and the stop (submitted_at; expires_at when absent).
 */
export function toTimeline(
  row: StaffAttemptContextRow,
  answers: readonly AnswerTimeRow[],
): TimelineEntryDTO[] {
  const entries: { at: Date; entry: TimelineEntryDTO }[] = [
    {
      at: row.startedAt,
      entry: {
        time: formatWibTime(row.startedAt),
        label: `Quiz dimulai · ${row.questionTotal} soal · batas ${row.durationMinutes} menit`,
        tone: "neutral",
      },
    },
  ];
  for (const answer of [...answers].sort(
    (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime(),
  )) {
    entries.push({
      at: answer.answeredAt,
      entry: {
        time: formatWibTime(answer.answeredAt),
        label: `Jawaban soal ${answer.position} tersimpan`,
        tone: "success",
      },
    });
  }
  if (row.attemptStatus !== "IN_PROGRESS") {
    const stoppedAt = row.submittedAt ?? row.expiresAt;
    const score = displayScore(row.scorePercent);
    entries.push({
      at: stoppedAt,
      entry: {
        time: formatWibTime(stoppedAt),
        label:
          row.attemptStatus === "EXPIRED"
            ? `Waktu habis · jawaban tersimpan dikumpulkan otomatis · nilai ${score}`
            : `Jawaban dikumpulkan · nilai ${score}`,
        tone: "neutral",
      },
    });
  }
  return entries.map((item) => item.entry);
}

export function toReportReviewDTO(input: {
  row: ReportReviewRow;
  answers: readonly AnswerTimeRow[];
  now: Date;
}): ReportReviewDTO {
  const { row } = input;
  const decided = row.status !== "PENDING";
  if (decided && (row.decisionReason === null || row.decidedAt === null)) {
    throw new Error("recovery serializer: decided report without a decision");
  }
  return {
    number: row.number,
    status: row.status,
    deadline: decided ? null : toDeadline(row.createdAt, input.now),
    reporter: {
      name: row.reporterName,
      email: row.reporterEmail,
      ordinal: row.reporterOrdinal,
    },
    createdAt: formatWib(row.createdAt),
    categoryLabel: REPORT_CATEGORY_LABELS[row.category],
    description: row.description,
    attempt: {
      attemptNumber: row.attemptNumber,
      kind: row.quizKind,
      lessonPosition: row.lessonPosition,
      contextLine: `${quizLabel(row.courseTitle, row.quizKind, row.lessonPosition)} · ${row.questionTotal} soal · ${row.durationMinutes} menit`,
      scorePercent: displayScore(row.scorePercent),
      remaining: remainingAtStop({
        status: row.attemptStatus,
        expiresAt: row.expiresAt,
        submittedAt: row.submittedAt,
      }),
      answered: row.answered,
      total: row.questionTotal,
    },
    timeline: toTimeline(row, input.answers),
    decision: decided
      ? {
          status: row.status as "APPROVED" | "REJECTED",
          reason: row.decisionReason!,
          internalNote: row.internalNote,
          decidedByName: row.decidedByName,
          decidedAt: formatWib(row.decidedAt!),
        }
      : null,
  };
}

// --------------------------------------------------- manual reset (26c)

/** One attempt of the looked-up user, with its quiz context. */
export type ManualAttemptRow = StaffAttemptContextRow & {
  quizId: string;
  courseId: string;
  resetAt: Date | null;
};

export type ManualBlockedReason = "ALREADY_RESET" | "FINAL_TAKEN";

export type ManualQuizItemDTO = {
  quizId: string;
  /** The live attempt the reset targets; null when only a reset row exists. */
  attemptId: string | null;
  label: string;
  meta: string;
  selectable: boolean;
  blockedReason: ManualBlockedReason | null;
  blockedLabel: string | null;
  pendingReportNumber: number | null;
};

export type ManualResetLookupDTO =
  | { found: false; email: string }
  | {
      found: true;
      email: string;
      user: { name: string; email: string };
      quizzes: ManualQuizItemDTO[];
    };

const STATUS_WORDS: Record<AttemptStatus, string> = {
  SUBMITTED: "Selesai normal",
  EXPIRED: "Waktu habis",
  IN_PROGRESS: "Sedang berjalan",
};

/** "Nilai 45 · 18 Sep 2026 · Waktu habis" (no score while running). */
export function manualAttemptMeta(row: StaffAttemptContextRow): string {
  const date = formatWibDate(row.submittedAt ?? row.startedAt);
  const parts =
    row.attemptStatus === "IN_PROGRESS"
      ? [date, STATUS_WORDS.IN_PROGRESS]
      : [`Nilai ${displayScore(row.scorePercent)}`, date, STATUS_WORDS[row.attemptStatus]];
  return parts.join(" · ");
}

/**
 * Group the user's attempts per quiz (decision 8): the live attempt is the
 * target; a quiz with ANY reset row is blocked (decision 4), and a lesson
 * quiz whose course already has a live Final attempt is blocked too
 * (decision 3). Order: course title, lesson position, Final last.
 */
export function toManualQuizItems(input: {
  rows: readonly ManualAttemptRow[];
  pendingByAttempt: ReadonlyMap<string, number>;
}): ManualQuizItemDTO[] {
  const byQuiz = new Map<string, ManualAttemptRow[]>();
  for (const row of input.rows) {
    byQuiz.set(row.quizId, [...(byQuiz.get(row.quizId) ?? []), row]);
  }
  const coursesWithLiveFinal = new Set(
    input.rows
      .filter((row) => row.quizKind === "FINAL" && row.resetAt === null)
      .map((row) => row.courseId),
  );

  const items: (ManualQuizItemDTO & { sort: [string, number] })[] = [];
  for (const [quizId, attempts] of byQuiz) {
    const sorted = [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber);
    const live = sorted.find((row) => row.resetAt === null) ?? null;
    const resetRow = sorted.find((row) => row.resetAt !== null) ?? null;
    const head = live ?? resetRow!;
    let blockedReason: ManualBlockedReason | null = null;
    let blockedLabel: string | null = null;
    if (resetRow !== null) {
      blockedReason = "ALREADY_RESET";
      blockedLabel = `Sudah pernah direset 1× · ${formatWibDate(resetRow.resetAt!)}`;
    } else if (head.quizKind === "LESSON" && coursesWithLiveFinal.has(head.courseId)) {
      blockedReason = "FINAL_TAKEN";
      blockedLabel = "Final Quiz kursus ini sudah dimulai — reset Final dulu";
    }
    items.push({
      quizId,
      attemptId: live?.attemptId ?? null,
      label: quizLabel(head.courseTitle, head.quizKind, head.lessonPosition),
      meta: live ? manualAttemptMeta(live) : blockedLabel!,
      selectable: live !== null && blockedReason === null,
      blockedReason,
      blockedLabel,
      pendingReportNumber: live ? (input.pendingByAttempt.get(live.attemptId) ?? null) : null,
      sort: [
        head.courseTitle,
        head.quizKind === "FINAL" ? Number.MAX_SAFE_INTEGER : (head.lessonPosition ?? 0),
      ],
    });
  }
  items.sort(
    (a, b) =>
      a.sort[0].localeCompare(b.sort[0], "id") || a.sort[1] - b.sort[1],
  );
  return items.map((item) => ({
    quizId: item.quizId,
    attemptId: item.attemptId,
    label: item.label,
    meta: item.meta,
    selectable: item.selectable,
    blockedReason: item.blockedReason,
    blockedLabel: item.blockedLabel,
    pendingReportNumber: item.pendingReportNumber,
  }));
}
