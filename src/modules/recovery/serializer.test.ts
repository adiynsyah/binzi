// Card S3-03: the recovery serializer — the participant DTO allowlist per
// state (no staff columns, ever), the deadline rule (decision 9), and the
// attempt summary numbers ("Terhenti di soal", remaining time).
import { describe, expect, it } from "vitest";

import {
  remainingAtStop,
  stoppedAtQuestion,
  toDeadline,
  toReportAlreadyResetDTO,
  toReportApprovedDTO,
  toReportFormDTO,
  toReportPendingDTO,
  toReportRejectedDTO,
  toTimeline,
  type ParticipantAttemptRow,
  type ParticipantReportRow,
  type ReportQuizContext,
  type StaffAttemptContextRow,
} from "./serializer";

const HOUR = 3_600_000;

const context: ReportQuizContext = {
  kind: "LESSON",
  lessonPosition: 2,
  quizHref: "/belajar/kursus-a/materi-b/quiz",
  courseHref: "/belajar/kursus-a",
  nextLesson: { position: 3, href: "/belajar/kursus-a/materi-c" },
};

const attempt: ParticipantAttemptRow = {
  id: "attempt-1",
  attemptNumber: 1,
  status: "SUBMITTED",
  questionOrder: ["q1", "q2", "q3"],
  startedAt: new Date("2026-09-19T07:02:00Z"),
  expiresAt: new Date("2026-09-19T07:17:00Z"),
  submittedAt: new Date("2026-09-19T07:07:46Z"),
  scorePercent: "33.33",
  resetAt: null,
};

/** A decided report row as the DB could hand it over — the staff columns
 *  ride along on purpose, to prove the builders never copy them. */
const reportWithStaffColumns = {
  number: 2291,
  attemptId: "attempt-1",
  status: "APPROVED",
  decisionReason: "Alasan untuk peserta.",
  decidedAt: new Date("2026-09-19T09:40:00Z"),
  createdAt: new Date("2026-09-19T07:09:00Z"),
  internalNote: "RAHASIA STAF",
  decidedBy: "u-admin-1",
  resetBy: "u-admin-1",
} as ParticipantReportRow;

describe("DTO peserta", () => {
  it("allowlist Object.keys per state", () => {
    const form = toReportFormDTO({ context, attempt, answered: 1 });
    expect(Object.keys(form).sort()).toEqual(
      ["attemptId", "eyebrow", "kind", "quizHref", "state", "summary"].sort(),
    );
    expect(Object.keys(form.summary).sort()).toEqual(
      ["answered", "attemptNumber", "remaining", "scope", "startedAt", "stoppedAt", "total"].sort(),
    );

    const pending = toReportPendingDTO({
      context,
      attempt,
      report: { ...reportWithStaffColumns, status: "PENDING" },
    });
    expect(Object.keys(pending).sort()).toEqual(
      [
        "courseHref",
        "createdAt",
        "deadlineDate",
        "eyebrow",
        "kind",
        "lessonPosition",
        "nextLesson",
        "number",
        "scorePercent",
        "state",
      ].sort(),
    );

    const approved = toReportApprovedDTO({ context, report: reportWithStaffColumns });
    expect(Object.keys(approved).sort()).toEqual(
      ["decidedAt", "decisionReason", "eyebrow", "kind", "lessonPosition", "quizHref", "state"].sort(),
    );

    const rejected = toReportRejectedDTO({
      context,
      attempt,
      report: { ...reportWithStaffColumns, status: "REJECTED" },
    });
    expect(Object.keys(rejected).sort()).toEqual(
      ["courseHref", "decisionReason", "eyebrow", "scorePercent", "state"].sort(),
    );

    const alreadyReset = toReportAlreadyResetDTO(context);
    expect(Object.keys(alreadyReset).sort()).toEqual(
      ["courseHref", "eyebrow", "state"].sort(),
    );

    for (const dto of [form, pending, approved, rejected, alreadyReset]) {
      const json = JSON.stringify(dto);
      expect(json).not.toContain("RAHASIA STAF");
      expect(json).not.toContain("u-admin-1");
    }
  });

  it("menunggu: Final tidak menawarkan materi berikutnya; nilai dibulatkan ke bawah", () => {
    const dto = toReportPendingDTO({
      context: { ...context, kind: "FINAL", lessonPosition: null },
      attempt,
      report: { ...reportWithStaffColumns, status: "PENDING" },
    });
    expect(dto.nextLesson).toBeNull();
    expect(dto.eyebrow).toBe("Final Quiz");
    expect(dto.scorePercent).toBe(33);
  });
});

describe("toDeadline", () => {
  const created = new Date("2026-09-19T07:00:00Z");
  const at = (hoursLeft: number) =>
    new Date(created.getTime() + 24 * HOUR - hoursLeft * HOUR);

  it("7 jam dan tepat 6 jam tidak merah, 5 j 59 m merah, lewat merah", () => {
    expect(toDeadline(created, at(18))).toEqual({ label: "sisa 18 jam", urgent: false });
    expect(toDeadline(created, at(7))).toEqual({ label: "sisa 7 jam", urgent: false });
    expect(toDeadline(created, at(6))).toEqual({ label: "sisa 6 jam", urgent: false });
    expect(toDeadline(created, at(5 + 59 / 60))).toEqual({
      label: "sisa 5 jam",
      urgent: true,
    });
    expect(toDeadline(created, at(0.25))).toEqual({ label: "sisa < 1 jam", urgent: true });
    expect(toDeadline(created, at(0))).toEqual({ label: "lewat < 1 jam", urgent: true });
    expect(toDeadline(created, at(-3.5))).toEqual({ label: "lewat 3 jam", urgent: true });
  });
});

describe("ringkasan attempt", () => {
  it("Terhenti di soal = tersimpan + 1, maksimal total", () => {
    expect(stoppedAtQuestion(0, 3)).toBe(1);
    expect(stoppedAtQuestion(1, 3)).toBe(2);
    expect(stoppedAtQuestion(3, 3)).toBe(3);
  });

  it("sisa waktu: SUBMITTED dari expires_at − submitted_at, EXPIRED → 00:00", () => {
    expect(remainingAtStop(attempt)).toBe("09:14");
    expect(remainingAtStop({ ...attempt, status: "EXPIRED" })).toBe("00:00");
    // Inside the 15-second tolerance after expiry: never negative.
    expect(
      remainingAtStop({
        ...attempt,
        submittedAt: new Date(attempt.expiresAt.getTime() + 10_000),
      }),
    ).toBe("00:00");
  });

  it("form: ringkasan lengkap untuk 1 dari 3 jawaban", () => {
    expect(toReportFormDTO({ context, attempt, answered: 1 }).summary).toMatchObject({
      attemptNumber: 1,
      scope: "Materi 2",
      stoppedAt: 2,
      total: 3,
      remaining: "09:14",
      answered: 1,
    });
  });
});

describe("toTimeline", () => {
  const row: StaffAttemptContextRow = {
    attemptId: "attempt-1",
    attemptNumber: 1,
    attemptStatus: "EXPIRED",
    startedAt: new Date("2026-09-19T07:02:11Z"),
    expiresAt: new Date("2026-09-19T07:17:11Z"),
    submittedAt: new Date("2026-09-19T07:17:20Z"),
    scorePercent: "33.33",
    questionTotal: 3,
    answered: 1,
    quizKind: "LESSON",
    durationMinutes: 15,
    courseTitle: "Kursus A",
    lessonPosition: 2,
  };

  it("hanya dari data DB, urut waktu, posisi soal dari question_order", () => {
    const timeline = toTimeline(row, [
      { position: 3, answeredAt: new Date("2026-09-19T07:05:02Z") },
      { position: 1, answeredAt: new Date("2026-09-19T07:03:40Z") },
    ]);
    expect(timeline).toEqual([
      { time: "14.02.11", label: "Quiz dimulai · 3 soal · batas 15 menit", tone: "neutral" },
      { time: "14.03.40", label: "Jawaban soal 1 tersimpan", tone: "success" },
      { time: "14.05.02", label: "Jawaban soal 3 tersimpan", tone: "success" },
      {
        time: "14.17.20",
        label: "Waktu habis · jawaban tersimpan dikumpulkan otomatis · nilai 33",
        tone: "neutral",
      },
    ]);
  });
});
