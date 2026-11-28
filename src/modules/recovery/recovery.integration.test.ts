// Integration tests for the recovery module (card S3-03) over PGlite — the
// attempt-module harness: committed Drizzle migrations on a fresh in-memory
// database (so every CHECK is read from the REAL 0002 file, not the TS
// schema), direct user inserts, real course/lesson services to build rows,
// and the REAL attempt + progress services to produce attempts.
//
// The PGlite database is shared by every test in this file (STATUS 22 Nov
// no. 1): each test builds its OWN member + course, and queue assertions
// work on deltas or on rows the test created.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  auditLogs,
  courses,
  enrollments,
  lessonProgress,
  questionOptions,
  questions,
  quizAttemptReports,
  quizAttempts,
  quizzes,
  users,
} from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { createCourse } from "@/modules/course/service";
import { createLesson } from "@/modules/lesson/service";
import {
  enrollInCourse,
  loadLessonQuizContext,
} from "@/modules/progress/service";

const dbHolder = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        const target = dbHolder.current as
          | Record<string | symbol, unknown>
          | undefined;
        if (!target) {
          throw new Error(
            "@/db mock used before the PGlite instance was installed",
          );
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    },
  ),
}));

import {
  getGradesPage,
  saveQuizAnswer,
  startFinalQuiz,
  startLessonQuiz,
  submitQuizAttempt,
} from "@/modules/attempt/service";

import {
  createAttemptReport,
  decideAttemptReport,
  findUserForManualReset,
  getAttemptReportPage,
  getAttemptReportReview,
  listAttemptReports,
  resetAttemptManually,
} from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

type Actor = {
  id: string;
  role: "MEMBER" | "EDITOR" | "ADMIN" | "SUPER_ADMIN";
  status: "ACTIVE";
};

const EDITOR: Actor = { id: "u-rc-editor", role: "EDITOR", status: "ACTIVE" };
const ADMIN: Actor = { id: "u-rc-admin", role: "ADMIN", status: "ACTIVE" };

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/migrations", import.meta.url),
    ),
  });
  db = pgliteDb as unknown as Db;
  dbHolder.current = pgliteDb;

  await db.insert(users).values([
    {
      id: EDITOR.id,
      name: "Editor Pemulihan",
      email: "rc-editor@example.com",
      emailVerified: true,
      role: "EDITOR",
    },
    {
      id: ADMIN.id,
      name: "Admin Pemulihan",
      email: "rc-admin@example.com",
      emailVerified: true,
      role: "ADMIN",
    },
  ]);
  // Score weights for the Final submit (S1-09 shape).
  for (const [key, value] of [
    ["score.lesson_weight", 60],
    ["score.final_weight", 40],
  ] as const) {
    await pglite.query(
      `insert into system_settings (key, value)
       values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [key, JSON.stringify(value)],
    );
  }
});

afterAll(async () => {
  await pglite.close();
});

// --- data builders -------------------------------------------------------

let counter = 0;
function nextToken(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** A fresh MEMBER per test (shared database). */
async function newMember(prefix: string, name?: string): Promise<Actor> {
  const token = nextToken(prefix);
  const id = `u-rc-${token}`;
  await db.insert(users).values({
    id,
    name: name ?? `Peserta ${token}`,
    email: `${token}@example.com`,
    emailVerified: true,
    role: "MEMBER",
  });
  return { id, role: "MEMBER", status: "ACTIVE" };
}

/** Fill a quiz with `count` one-point questions, key = first option. */
async function fillQuiz(quizId: string, count: number): Promise<void> {
  await db
    .update(quizzes)
    .set({ shuffleQuestions: false, shuffleOptions: false, durationMinutes: 10 })
    .where(eq(quizzes.id, quizId));
  for (let index = 0; index < count; index += 1) {
    const [question] = await db
      .insert(questions)
      .values({
        quizId,
        orderIndex: index + 1,
        type: "SINGLE_CHOICE",
        text: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Soal netral ${index + 1}` }],
            },
          ],
        },
        explanation: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Pembahasan ${index + 1}` }],
            },
          ],
        },
        points: 1,
      })
      .returning();
    await db.insert(questionOptions).values([
      { questionId: question!.id, orderIndex: 0, text: "Opsi A", isCorrect: true },
      { questionId: question!.id, orderIndex: 1, text: "Opsi B", isCorrect: false },
    ]);
  }
}

type Fixture = {
  member: Actor;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  finalQuizId: string;
  lessons: { id: string; slug: string; quizId: string }[];
};

/**
 * PUBLISHED sequential course with two lessons (each with a 4-question
 * quiz, no video → the quiz alone completes the lesson) and a 4-question
 * Final; a fresh MEMBER enrolled.
 */
async function recoveryCourse(prefix: string, memberName?: string): Promise<Fixture> {
  const member = await newMember(prefix, memberName);
  const token = nextToken(prefix);
  const course = await createCourse(EDITOR, {
    title: `Kursus ${token}`,
    slug: `kursus-${token}`,
    level: "BEGINNER",
    summary: "Ringkasan netral untuk tes.",
  });
  const lessonRows = [
    await createLesson(EDITOR, course.id, { title: `Materi satu ${token}` }),
    await createLesson(EDITOR, course.id, { title: `Materi dua ${token}` }),
  ];
  for (const lesson of lessonRows) await fillQuiz(lesson.quizId, 4);
  const [courseRow] = await db
    .select({ finalQuizId: courses.finalQuizId })
    .from(courses)
    .where(eq(courses.id, course.id));
  await fillQuiz(courseRow!.finalQuizId!, 4);
  await db
    .update(courses)
    .set({ status: "PUBLISHED" })
    .where(eq(courses.id, course.id));
  await enrollInCourse(member, course.id);
  return {
    member,
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: course.title,
    finalQuizId: courseRow!.finalQuizId!,
    lessons: lessonRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      quizId: row.quizId,
    })),
  };
}

/** Answer the first `correct` questions with the key (rest unanswered). */
async function answerAttempt(
  member: Actor,
  attemptId: string,
  quizId: string,
  correct: number,
): Promise<void> {
  const rows = await db
    .select({ questionId: questions.id, optionId: questionOptions.id })
    .from(questionOptions)
    .innerJoin(questions, eq(questionOptions.questionId, questions.id))
    .where(and(eq(questions.quizId, quizId), eq(questionOptions.isCorrect, true)))
    .orderBy(questions.orderIndex);
  for (const row of rows.slice(0, correct)) {
    await saveQuizAnswer(member, {
      attemptId,
      questionId: row.questionId,
      optionId: row.optionId,
    });
  }
}

/** Start → answer → submit the lesson quiz; returns the attempt id. */
async function doLessonQuiz(
  fixture: Fixture,
  lessonIndex: number,
  correct: number,
): Promise<string> {
  const lesson = fixture.lessons[lessonIndex]!;
  const { attemptId } = await startLessonQuiz(fixture.member, {
    lessonId: lesson.id,
  });
  await answerAttempt(fixture.member, attemptId, lesson.quizId, correct);
  await submitQuizAttempt(fixture.member, { attemptId });
  return attemptId;
}

/** Start → answer → submit the Final; returns the attempt id. */
async function doFinal(fixture: Fixture, correct: number): Promise<string> {
  const { attemptId } = await startFinalQuiz(fixture.member, {
    courseId: fixture.courseId,
  });
  await answerAttempt(fixture.member, attemptId, fixture.finalQuizId, correct);
  await submitQuizAttempt(fixture.member, { attemptId });
  return attemptId;
}

async function attemptRow(attemptId: string) {
  const [row] = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId));
  return row!;
}

// --- 0002 CHECK constraints ----------------------------------------------

describe("CHECK quiz_attempt_reports (berkas 0002)", () => {
  async function insertRaw(
    attemptId: string,
    userId: string,
    status: string,
    decidedAt: string | null,
    decisionReason: string | null,
  ) {
    return pglite.query(
      `insert into quiz_attempt_reports
         (attempt_id, user_id, category, description, status, decided_at, decision_reason)
       values ($1, $2, 'OTHER', 'Cerita netral untuk tes CHECK.', $3, $4::timestamptz, $5)`,
      [attemptId, userId, status, decidedAt, decisionReason],
    );
  }

  it("APPROVED tanpa decided_at ditolak DB", async () => {
    const fixture = await recoveryCourse("ck1");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await expect(
      insertRaw(attemptId, fixture.member.id, "APPROVED", null, "Alasan netral."),
    ).rejects.toThrow(/quiz_attempt_reports_decided_at_check/);
  });

  it("PENDING dengan decided_at ditolak DB", async () => {
    const fixture = await recoveryCourse("ck2");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await expect(
      insertRaw(
        attemptId,
        fixture.member.id,
        "PENDING",
        new Date().toISOString(),
        null,
      ),
    ).rejects.toThrow(/quiz_attempt_reports_decided_at_check/);
  });

  it("REJECTED tanpa decision_reason ditolak DB", async () => {
    const fixture = await recoveryCourse("ck3");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await expect(
      insertRaw(
        attemptId,
        fixture.member.id,
        "REJECTED",
        new Date().toISOString(),
        null,
      ),
    ).rejects.toThrow(/quiz_attempt_reports_decision_reason_check/);
  });

  it("baris sah diterima; laporan kedua untuk attempt yang sama ditolak UNIQUE", async () => {
    const fixture = await recoveryCourse("ck4");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await insertRaw(attemptId, fixture.member.id, "PENDING", null, null);
    await expect(
      insertRaw(attemptId, fixture.member.id, "PENDING", null, null),
    ).rejects.toThrow(/quiz_attempt_reports_attempt_unique/);
    const rows = await pglite.query(
      `select number from quiz_attempt_reports where attempt_id = $1`,
      [attemptId],
    );
    expect(rows.rows).toHaveLength(1);
    expect((await attemptRow(attemptId)).status).toBe("SUBMITTED");
  });
});

// --- shared helpers for the service tests ---------------------------------

const REPORT = {
  category: "SUBMIT_ERROR" as const,
  description: "Halaman berubah putih setelah menekan tombol kumpulkan.",
};
const REASON = "Catatan sistem mendukung laporan ini.";

async function reportRow(number: number) {
  const [row] = await db
    .select()
    .from(quizAttemptReports)
    .where(eq(quizAttemptReports.number, number));
  return row!;
}

async function progressRow(userId: string, lessonId: string) {
  const [row] = await db
    .select()
    .from(lessonProgress)
    .where(
      and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)),
    );
  return row;
}

async function enrollmentRow(userId: string, courseId: string) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
  return row!;
}

async function auditRowsFor(entityId: string) {
  return db.select().from(auditLogs).where(eq(auditLogs.entityId, entityId));
}

async function auditCount(): Promise<number> {
  return (await db.select({ id: auditLogs.id }).from(auditLogs)).length;
}

/** Both lessons + the Final submitted (Final needs every lesson COMPLETED). */
async function finishedCourse(prefix: string) {
  const fixture = await recoveryCourse(prefix);
  const lesson1 = await doLessonQuiz(fixture, 0, 2);
  const lesson2 = await doLessonQuiz(fixture, 1, 3);
  const final = await doFinal(fixture, 2);
  return { fixture, lesson1, lesson2, final };
}

const lessonTarget = (fixture: Fixture, index: number) => ({
  kind: "LESSON" as const,
  courseSlug: fixture.courseSlug,
  lessonSlug: fixture.lessons[index]!.slug,
});

// --- createAttemptReport ---------------------------------------------------

describe("createAttemptReport", () => {
  it("attempt milik peserta lain → 404 seragam", async () => {
    const fixture = await recoveryCourse("cr1");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    const stranger = await newMember("cr1-lain");
    const foreign = createAttemptReport(stranger, attemptId, REPORT);
    await expect(foreign).rejects.toThrow(NotFoundError);
    await expect(foreign).rejects.toThrow("Quiz tidak ditemukan.");
    // Same answer as an id that does not exist at all (V-05).
    await expect(
      createAttemptReport(stranger, "00000000-0000-4000-8000-000000000000", REPORT),
    ).rejects.toThrow("Quiz tidak ditemukan.");
    const rows = await db
      .select()
      .from(quizAttemptReports)
      .where(eq(quizAttemptReports.attemptId, attemptId));
    expect(rows).toHaveLength(0);
  });

  it("attempt IN_PROGRESS → 409", async () => {
    const fixture = await recoveryCourse("cr2");
    const { attemptId } = await startLessonQuiz(fixture.member, {
      lessonId: fixture.lessons[0]!.id,
    });
    await expect(
      createAttemptReport(fixture.member, attemptId, REPORT),
    ).rejects.toThrow(new ConflictError("Quiz ini belum selesai."));
  });

  it("attempt ber-reset_at → 409", async () => {
    const fixture = await recoveryCourse("cr3");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await resetAttemptManually(ADMIN, attemptId, { reason: REASON });
    // The OLD (reset) attempt itself — caught by its own reset_at.
    await expect(
      createAttemptReport(fixture.member, attemptId, REPORT),
    ).rejects.toThrow(new ConflictError("Quiz ini sudah pernah direset."));
  });

  it("quiz yang pernah direset (attempt baru sudah selesai) → 409", async () => {
    const fixture = await recoveryCourse("cr4");
    const first = await doLessonQuiz(fixture, 0, 2);
    await resetAttemptManually(ADMIN, first, { reason: REASON });
    // The LIVE attempt no. 2 (SUBMITTED, reset_at NULL) — only the
    // "quiz was reset before" guard can refuse it (decision 4).
    const second = await doLessonQuiz(fixture, 0, 4);
    const row = await attemptRow(second);
    expect(row.attemptNumber).toBe(2);
    expect(row.status).toBe("SUBMITTED");
    expect(row.resetAt).toBeNull();
    await expect(
      createAttemptReport(fixture.member, second, REPORT),
    ).rejects.toThrow(new ConflictError("Quiz ini sudah pernah direset."));
  });

  it("laporan kedua → 409", async () => {
    const fixture = await recoveryCourse("cr5");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await createAttemptReport(fixture.member, attemptId, REPORT);
    await expect(
      createAttemptReport(fixture.member, attemptId, {
        category: "OTHER",
        description: "Laporan kedua untuk attempt yang sama persis.",
      }),
    ).rejects.toThrow(new ConflictError("Attempt ini sudah dilaporkan."));
  });

  it("sukses: PENDING, user_id dari attempt, cerita di-trim, nomor dikembalikan", async () => {
    const fixture = await recoveryCourse("cr6");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    const { number } = await createAttemptReport(fixture.member, attemptId, {
      category: "TIMER_ENDED_EARLY",
      description: `   ${REPORT.description}   `,
    });
    const row = await reportRow(number);
    expect(row).toMatchObject({
      attemptId,
      userId: fixture.member.id,
      category: "TIMER_ENDED_EARLY",
      description: REPORT.description,
      status: "PENDING",
      decisionReason: null,
      decidedAt: null,
      decidedBy: null,
    });
  });

  it("cerita < 20 karakter → ZodError, tidak ada baris", async () => {
    const fixture = await recoveryCourse("cr7");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await expect(
      createAttemptReport(fixture.member, attemptId, {
        category: "OTHER",
        description: "terlalu pendek",
      }),
    ).rejects.toThrow("Ceritakan minimal 20 karakter.");
    const rows = await db
      .select()
      .from(quizAttemptReports)
      .where(eq(quizAttemptReports.attemptId, attemptId));
    expect(rows).toHaveLength(0);
  });
});

// --- getAttemptReportPage --------------------------------------------------

describe("getAttemptReportPage", () => {
  it("form: ringkasan dari attempt (nomor, terhenti di soal, sisa waktu, jawaban tersimpan)", async () => {
    const fixture = await recoveryCourse("pg1");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    const page = await getAttemptReportPage(fixture.member, lessonTarget(fixture, 0));
    expect(page).toMatchObject({
      state: "form",
      eyebrow: "Quiz materi 1",
      kind: "LESSON",
      attemptId,
      quizHref: `/belajar/${fixture.courseSlug}/${fixture.lessons[0]!.slug}/quiz`,
      summary: {
        attemptNumber: 1,
        scope: "Materi 1",
        stoppedAt: 3,
        total: 4,
        answered: 2,
      },
    });
    // Submitted inside a 10-minute window → some time was left.
    expect((page as { summary: { remaining: string } }).summary.remaining).toMatch(
      /^(0\d|10):\d\d$/,
    );
  });

  it("menunggu: nomor, nilai, materi berikutnya; materi terakhir tanpa materi berikutnya", async () => {
    const fixture = await recoveryCourse("pg2");
    const first = await doLessonQuiz(fixture, 0, 2);
    const second = await doLessonQuiz(fixture, 1, 1);
    const one = await createAttemptReport(fixture.member, first, REPORT);
    await createAttemptReport(fixture.member, second, REPORT);
    const page = await getAttemptReportPage(fixture.member, lessonTarget(fixture, 0));
    expect(page).toMatchObject({
      state: "menunggu",
      number: one.number,
      scorePercent: 50,
      nextLesson: {
        position: 2,
        href: `/belajar/${fixture.courseSlug}/${fixture.lessons[1]!.slug}`,
      },
      courseHref: `/belajar/${fixture.courseSlug}`,
    });
    const last = await getAttemptReportPage(fixture.member, lessonTarget(fixture, 1));
    expect(last).toMatchObject({ state: "menunggu", scorePercent: 25, nextLesson: null });
  });

  it("ditolak, lalu disetujui, lalu sudah-direset setelah dikerjakan ulang", async () => {
    const fixture = await recoveryCourse("pg3");
    const first = await doLessonQuiz(fixture, 0, 2);
    const second = await doLessonQuiz(fixture, 1, 1);
    const rejected = await createAttemptReport(fixture.member, second, REPORT);
    await decideAttemptReport(ADMIN, rejected.number, {
      decision: "REJECT",
      reason: "Jawaban terkirim normal menurut catatan.",
    });
    expect(
      await getAttemptReportPage(fixture.member, lessonTarget(fixture, 1)),
    ).toEqual({
      state: "ditolak",
      eyebrow: "Quiz materi 2",
      scorePercent: 25,
      decisionReason: "Jawaban terkirim normal menurut catatan.",
      courseHref: `/belajar/${fixture.courseSlug}`,
    });

    const approved = await createAttemptReport(fixture.member, first, REPORT);
    await decideAttemptReport(ADMIN, approved.number, {
      decision: "APPROVE",
      reason: REASON,
      internalNote: "Catatan staf saja.",
    });
    const approvedPage = await getAttemptReportPage(
      fixture.member,
      lessonTarget(fixture, 0),
    );
    expect(approvedPage).toMatchObject({
      state: "disetujui",
      decisionReason: REASON,
      quizHref: `/belajar/${fixture.courseSlug}/${fixture.lessons[0]!.slug}/quiz`,
    });
    expect(JSON.stringify(approvedPage)).not.toContain("Catatan staf saja.");

    await doLessonQuiz(fixture, 0, 4);
    expect(
      await getAttemptReportPage(fixture.member, lessonTarget(fixture, 0)),
    ).toEqual({
      state: "sudah-direset",
      eyebrow: "Quiz materi 1",
      courseHref: `/belajar/${fixture.courseSlug}`,
    });
  });

  it("redirect ke halaman quiz: belum ada attempt, attempt berjalan, reset manual belum dikerjakan ulang", async () => {
    const fixture = await recoveryCourse("pg4");
    const quizPage = `/belajar/${fixture.courseSlug}/${fixture.lessons[0]!.slug}/quiz`;
    expect(
      await getAttemptReportPage(fixture.member, lessonTarget(fixture, 0)),
    ).toEqual({ redirect: quizPage });
    const { attemptId } = await startLessonQuiz(fixture.member, {
      lessonId: fixture.lessons[0]!.id,
    });
    expect(
      await getAttemptReportPage(fixture.member, lessonTarget(fixture, 0)),
    ).toEqual({ redirect: quizPage });
    await resetAttemptManually(ADMIN, attemptId, { reason: REASON });
    expect(
      await getAttemptReportPage(fixture.member, lessonTarget(fixture, 0)),
    ).toEqual({ redirect: quizPage });
  });

  it("Final: form lalu menunggu tanpa materi berikutnya", async () => {
    const { fixture, final } = await finishedCourse("pg5");
    const target = { kind: "FINAL" as const, courseSlug: fixture.courseSlug };
    expect(await getAttemptReportPage(fixture.member, target)).toMatchObject({
      state: "form",
      eyebrow: "Final Quiz",
      attemptId: final,
      quizHref: `/belajar/${fixture.courseSlug}/final-quiz`,
      summary: { scope: "Final Quiz", answered: 2, total: 4, stoppedAt: 3 },
    });
    await createAttemptReport(fixture.member, final, REPORT);
    expect(await getAttemptReportPage(fixture.member, target)).toMatchObject({
      state: "menunggu",
      kind: "FINAL",
      scorePercent: 50,
      nextLesson: null,
    });
  });

  it("slug tak dikenal → 404; laporan peserta lain tidak terlihat", async () => {
    const fixture = await recoveryCourse("pg6");
    await expect(
      getAttemptReportPage(fixture.member, {
        kind: "LESSON",
        courseSlug: fixture.courseSlug,
        lessonSlug: "tidak-ada",
      }),
    ).rejects.toThrow(NotFoundError);
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await createAttemptReport(fixture.member, attemptId, REPORT);
    // Another enrolled participant sees THEIR state (no attempt → quiz page).
    const other = await newMember("pg6-lain");
    await enrollInCourse(other, fixture.courseId);
    expect(
      await getAttemptReportPage(other, lessonTarget(fixture, 0)),
    ).toEqual({
      redirect: `/belajar/${fixture.courseSlug}/${fixture.lessons[0]!.slug}/quiz`,
    });
  });
});

// --- approve: lesson quiz ----------------------------------------------------

describe("setujui laporan quiz materi", () => {
  it("kolom reset, lesson_progress, laporan APPROVED, satu audit", async () => {
    const fixture = await recoveryCourse("ap1");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    const before = await progressRow(fixture.member.id, fixture.lessons[0]!.id);
    expect(before).toMatchObject({ quizAttempted: true, status: "COMPLETED" });
    const { number } = await createAttemptReport(fixture.member, attemptId, REPORT);

    const result = await decideAttemptReport(ADMIN, number, {
      decision: "APPROVE",
      reason: `  ${REASON}  `,
      internalNote: "Galat di sisi server.",
    });
    expect(result).toEqual({ status: "APPROVED" });

    const attempt = await attemptRow(attemptId);
    expect(attempt.resetBy).toBe(ADMIN.id);
    expect(attempt.resetReason).toBe(REASON);
    expect(attempt.resetAt).toBeInstanceOf(Date);
    expect(attempt.status).toBe("SUBMITTED");
    expect(attempt.scorePercent).toBe("50.00");

    expect(
      await progressRow(fixture.member.id, fixture.lessons[0]!.id),
    ).toMatchObject({
      quizAttempted: false,
      quizScorePercent: null,
      quizIsPassed: null,
      quizSubmittedAt: null,
      status: "IN_PROGRESS",
      completedAt: null,
    });

    const report = await reportRow(number);
    expect(report).toMatchObject({
      status: "APPROVED",
      decisionReason: REASON,
      internalNote: "Galat di sisi server.",
      decidedBy: ADMIN.id,
    });
    expect(report.decidedAt).toBeInstanceOf(Date);

    const audits = await auditRowsFor(attemptId);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: ADMIN.id,
      action: "attempt.reset",
      entityType: "quiz_attempt",
      before: { status: "SUBMITTED", scorePercent: "50.00", quizType: "LESSON" },
      after: {
        status: "SUBMITTED",
        resetReason: REASON,
        internalNote: "Galat di sisi server.",
        reportNumber: number,
      },
    });
  });

  it("start baru attempt ke-2 dan Nilai Saya tanpa skor lama", async () => {
    const fixture = await recoveryCourse("ap2");
    const attemptId = await doLessonQuiz(fixture, 0, 1);
    // Lesson 2 too, so the course stays on Nilai Saya after the reset (a
    // course without any result is not listed — S5-03 decision 3).
    await doLessonQuiz(fixture, 1, 3);
    const gradesBefore = await getGradesPage(fixture.member);
    const courseBefore = gradesBefore.courses.find((c) => c.id === fixture.courseId)!;
    expect(courseBefore.lessons.map((row) => row.result?.scorePercent ?? null)).toEqual([
      25, 75,
    ]);

    const { number } = await createAttemptReport(fixture.member, attemptId, REPORT);
    await decideAttemptReport(ADMIN, number, { decision: "APPROVE", reason: REASON });

    const gradesAfter = await getGradesPage(fixture.member);
    const courseAfter = gradesAfter.courses.find((c) => c.id === fixture.courseId)!;
    expect(courseAfter.lessons.map((row) => row.result?.scorePercent ?? null)).toEqual([
      null, 75,
    ]);
    expect(courseAfter.lessonAveragePercent).toBe(75);

    const started = await startLessonQuiz(fixture.member, {
      lessonId: fixture.lessons[0]!.id,
    });
    expect(started.created).toBe(true);
    expect((await attemptRow(started.attemptId)).attemptNumber).toBe(2);
  });

  it("materi berikutnya terkunci lagi", async () => {
    const fixture = await recoveryCourse("ap3");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    await expect(
      loadLessonQuizContext(db, fixture.member.id, fixture.lessons[1]!.id),
    ).resolves.toMatchObject({ lessonPosition: 2 });
    const { number } = await createAttemptReport(fixture.member, attemptId, REPORT);
    await decideAttemptReport(ADMIN, number, { decision: "APPROVE", reason: REASON });
    await expect(
      loadLessonQuizContext(db, fixture.member.id, fixture.lessons[1]!.id),
    ).rejects.toThrow(new ConflictError("Materi ini masih terkunci."));
  });
});

// --- approve: Final ------------------------------------------------------------

describe("setujui laporan Final", () => {
  it("enrollments dibalik, startFinalQuiz berhasil", async () => {
    const { fixture, final } = await finishedCourse("af1");
    const before = await enrollmentRow(fixture.member.id, fixture.courseId);
    expect(before.status).not.toBe("IN_PROGRESS");
    expect(before.finalScorePercent).not.toBeNull();
    expect(before.completedAt).not.toBeNull();

    const { number } = await createAttemptReport(fixture.member, final, REPORT);
    await decideAttemptReport(ADMIN, number, { decision: "APPROVE", reason: REASON });

    expect(await enrollmentRow(fixture.member.id, fixture.courseId)).toMatchObject({
      status: "IN_PROGRESS",
      finalScorePercent: null,
      completedAt: null,
    });
    // Lesson rows stay untouched by a Final reset.
    expect(
      await progressRow(fixture.member.id, fixture.lessons[0]!.id),
    ).toMatchObject({ quizAttempted: true, quizScorePercent: "50.00" });
    const started = await startFinalQuiz(fixture.member, {
      courseId: fixture.courseId,
    });
    expect(started.created).toBe(true);
    expect((await attemptRow(started.attemptId)).attemptNumber).toBe(2);
  });
});

// --- reject ------------------------------------------------------------------------

describe("tolak", () => {
  it("attempt dan progres tidak berubah, laporan REJECTED, audit attempt_report.reject", async () => {
    const fixture = await recoveryCourse("tj1");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    const attemptBefore = await attemptRow(attemptId);
    const progressBefore = await progressRow(fixture.member.id, fixture.lessons[0]!.id);
    const { number } = await createAttemptReport(fixture.member, attemptId, REPORT);

    const result = await decideAttemptReport(ADMIN, number, {
      decision: "REJECT",
      reason: "Jawaban terkirim normal menurut catatan.",
    });
    expect(result).toEqual({ status: "REJECTED" });

    const attemptAfter = await attemptRow(attemptId);
    expect(attemptAfter.resetAt).toBeNull();
    expect(attemptAfter.resetBy).toBeNull();
    expect(attemptAfter.status).toBe(attemptBefore.status);
    expect(attemptAfter.scorePercent).toBe(attemptBefore.scorePercent);
    expect(
      await progressRow(fixture.member.id, fixture.lessons[0]!.id),
    ).toEqual(progressBefore);

    const report = await reportRow(number);
    expect(report).toMatchObject({
      status: "REJECTED",
      decisionReason: "Jawaban terkirim normal menurut catatan.",
      internalNote: null,
      decidedBy: ADMIN.id,
    });
    expect(await auditRowsFor(attemptId)).toHaveLength(0);
    const audits = await auditRowsFor(report.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "attempt_report.reject",
      entityType: "quiz_attempt_report",
      before: { status: "PENDING", reportNumber: number },
      after: { status: "REJECTED", reportNumber: number },
    });
  });
});

// --- guards ------------------------------------------------------------------------

describe("penjaga", () => {
  it("quiz materi dengan Final hidup → 409 dan tidak ada baris berubah", async () => {
    const { fixture, lesson1 } = await finishedCourse("gd1");
    const { number } = await createAttemptReport(fixture.member, lesson1, REPORT);
    const snapshot = async () => ({
      attempt: await attemptRow(lesson1),
      progress: await progressRow(fixture.member.id, fixture.lessons[0]!.id),
      enrollment: await enrollmentRow(fixture.member.id, fixture.courseId),
      report: await reportRow(number),
      audits: await auditCount(),
    });
    const before = await snapshot();
    await expect(
      decideAttemptReport(ADMIN, number, { decision: "APPROVE", reason: REASON }),
    ).rejects.toThrow(
      new ConflictError(
        "Final Quiz kursus ini sudah dimulai. Reset Final Quiz dulu lewat Reset tanpa laporan, lalu putuskan laporan ini.",
      ),
    );
    await expect(
      resetAttemptManually(ADMIN, lesson1, { reason: REASON }),
    ).rejects.toThrow(ConflictError);
    expect(await snapshot()).toEqual(before);
  });

  it("reset kedua quiz yang sama → 409", async () => {
    const fixture = await recoveryCourse("gd2");
    const first = await doLessonQuiz(fixture, 0, 2);
    await resetAttemptManually(ADMIN, first, { reason: REASON });
    const second = await doLessonQuiz(fixture, 0, 4);
    const auditsBefore = await auditCount();
    await expect(
      resetAttemptManually(ADMIN, second, { reason: REASON }),
    ).rejects.toThrow(new ConflictError("Quiz ini sudah pernah direset."));
    expect((await attemptRow(second)).resetAt).toBeNull();
    expect(await auditCount()).toBe(auditsBefore);
    // The SAME (already reset) attempt again → its own 409.
    await expect(
      resetAttemptManually(ADMIN, first, { reason: REASON }),
    ).rejects.toThrow(new ConflictError("Attempt ini sudah pernah direset."));
  });

  it("keputusan untuk laporan yang sudah diputuskan → 409", async () => {
    const fixture = await recoveryCourse("gd3");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    const { number } = await createAttemptReport(fixture.member, attemptId, REPORT);
    await decideAttemptReport(ADMIN, number, {
      decision: "REJECT",
      reason: "Jawaban terkirim normal menurut catatan.",
    });
    await expect(
      decideAttemptReport(ADMIN, number, { decision: "APPROVE", reason: REASON }),
    ).rejects.toThrow(new ConflictError("Laporan ini sudah diputuskan."));
    expect((await attemptRow(attemptId)).resetAt).toBeNull();
    await expect(
      decideAttemptReport(ADMIN, 2_000_000_000, { decision: "REJECT", reason: REASON }),
    ).rejects.toThrow(NotFoundError);
  });
});

// --- manual reset ------------------------------------------------------------------

describe("reset manual", () => {
  it("attempt IN_PROGRESS → EXPIRED + reset, lalu start baru berhasil", async () => {
    const fixture = await recoveryCourse("mr1");
    const { attemptId } = await startLessonQuiz(fixture.member, {
      lessonId: fixture.lessons[0]!.id,
    });
    expect(
      await resetAttemptManually(ADMIN, attemptId, { reason: REASON }),
    ).toEqual({ attemptId });
    const row = await attemptRow(attemptId);
    expect(row.status).toBe("EXPIRED");
    expect(row.resetAt).toBeInstanceOf(Date);
    expect(row.resetReason).toBe(REASON);
    const started = await startLessonQuiz(fixture.member, {
      lessonId: fixture.lessons[0]!.id,
    });
    expect(started.created).toBe(true);
    expect(started.attemptId).not.toBe(attemptId);
    expect((await attemptRow(started.attemptId)).attemptNumber).toBe(2);
  });

  it("laporan PENDING attempt itu ikut APPROVED dengan alasan sama", async () => {
    const fixture = await recoveryCourse("mr2");
    const attemptId = await doLessonQuiz(fixture, 0, 2);
    const { number } = await createAttemptReport(fixture.member, attemptId, REPORT);
    await resetAttemptManually(ADMIN, attemptId, {
      reason: REASON,
      internalNote: "Lewat WhatsApp.",
    });
    expect(await reportRow(number)).toMatchObject({
      status: "APPROVED",
      decisionReason: REASON,
      internalNote: "Lewat WhatsApp.",
      decidedBy: ADMIN.id,
    });
    const audits = await auditRowsFor(attemptId);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "attempt.reset",
      after: { reportNumber: number, resetReason: REASON },
    });
    // The participant now reads the approval on the report page.
    expect(
      await getAttemptReportPage(fixture.member, lessonTarget(fixture, 0)),
    ).toMatchObject({ state: "disetujui", decisionReason: REASON });
  });

  it("findUserForManualReset — email dinormalisasi, user terhapus tidak ditemukan, alasan blokir dan laporan menunggu", async () => {
    const { fixture, lesson1, lesson2, final } = await finishedCourse("mr3");
    const { number } = await createAttemptReport(fixture.member, final, REPORT);
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, fixture.member.id));

    const found = await findUserForManualReset(ADMIN, {
      email: `  ${user!.email.toUpperCase()}  `,
    });
    expect(found.found).toBe(true);
    if (!found.found) return;
    expect(found.quizzes.map((item) => [item.label, item.attemptId, item.selectable])).toEqual([
      [`${fixture.courseTitle} · Materi 1`, lesson1, false],
      [`${fixture.courseTitle} · Materi 2`, lesson2, false],
      [`${fixture.courseTitle} · Final Quiz`, final, true],
    ]);
    expect(found.quizzes[0]!.blockedReason).toBe("FINAL_TAKEN");
    expect(found.quizzes[2]!.pendingReportNumber).toBe(number);
    expect(found.quizzes[2]!.meta).toMatch(/^Nilai 50 · .+ · Selesai normal$/);

    // Reset the Final → lessons become selectable; the Final shows reset.
    await resetAttemptManually(ADMIN, final, { reason: REASON });
    const after = await findUserForManualReset(ADMIN, { email: user!.email });
    if (!after.found) throw new Error("expected user");
    expect(after.quizzes.map((item) => [item.selectable, item.blockedReason])).toEqual([
      [true, null],
      [true, null],
      [false, "ALREADY_RESET"],
    ]);
    expect(after.quizzes[2]!.attemptId).toBeNull();
    expect(after.quizzes[2]!.blockedLabel).toMatch(/^Sudah pernah direset 1× · /);

    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, fixture.member.id));
    expect(
      await findUserForManualReset(ADMIN, { email: user!.email }),
    ).toEqual({ found: false, email: user!.email });
  });
});

// --- queue --------------------------------------------------------------------------

/** Raw finished attempts + PENDING reports for queue tests (no service
 *  path needed: the queue reads rows, it does not write them). */
async function rawReports(
  fixture: Fixture,
  specs: { createdAt: string; id: string }[],
  firstAttemptNumber = 10,
): Promise<number[]> {
  const enrollment = await enrollmentRow(fixture.member.id, fixture.courseId);
  const numbers: number[] = [];
  for (const [index, spec] of specs.entries()) {
    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        quizId: fixture.lessons[0]!.quizId,
        userId: fixture.member.id,
        enrollmentId: enrollment.id,
        attemptNumber: firstAttemptNumber + index,
        status: "SUBMITTED",
        questionOrder: [],
        startedAt: new Date(spec.createdAt),
        expiresAt: new Date(spec.createdAt),
        submittedAt: new Date(spec.createdAt),
        scorePercent: "10.00",
      })
      .returning({ id: quizAttempts.id });
    const [report] = await db
      .insert(quizAttemptReports)
      .values({
        id: spec.id,
        attemptId: attempt!.id,
        userId: fixture.member.id,
        category: "OTHER",
        description: "Laporan netral untuk tes antrean.",
        createdAt: new Date(spec.createdAt),
      })
      .returning({ number: quizAttemptReports.number });
    numbers.push(report!.number);
  }
  return numbers;
}

describe("antrean", () => {
  it("hitungan per status (dua laporan per status)", async () => {
    const before = await listAttemptReports(ADMIN, { status: "ALL" });
    const made = [
      await finishedCourse("qc1"),
      await finishedCourse("qc2"),
      await finishedCourse("qc3"),
    ];
    const numbers: number[] = [];
    for (const { fixture, lesson1, lesson2 } of made) {
      numbers.push((await createAttemptReport(fixture.member, lesson1, REPORT)).number);
      numbers.push((await createAttemptReport(fixture.member, lesson2, REPORT)).number);
    }
    // qc1: both REJECTED; qc2: both APPROVED (via the Final first? no —
    // lessons are blocked by the live Final, so approve its two lesson
    // reports only after a manual Final reset); qc3: both PENDING.
    for (const number of numbers.slice(0, 2)) {
      await decideAttemptReport(ADMIN, number, {
        decision: "REJECT",
        reason: "Jawaban terkirim normal menurut catatan.",
      });
    }
    await resetAttemptManually(ADMIN, made[1]!.final, { reason: REASON });
    for (const number of numbers.slice(2, 4)) {
      await decideAttemptReport(ADMIN, number, { decision: "APPROVE", reason: REASON });
    }

    const after = await listAttemptReports(ADMIN, { status: "ALL" });
    expect({
      PENDING: after.counts.PENDING - before.counts.PENDING,
      APPROVED: after.counts.APPROVED - before.counts.APPROVED,
      REJECTED: after.counts.REJECTED - before.counts.REJECTED,
      ALL: after.counts.ALL - before.counts.ALL,
    }).toEqual({ PENDING: 2, APPROVED: 2, REJECTED: 2, ALL: 6 });

    // Each tab holds only its status.
    for (const status of ["PENDING", "APPROVED", "REJECTED"] as const) {
      const tab = await listAttemptReports(ADMIN, { status });
      expect(tab.items.every((item) => item.status === status)).toBe(true);
    }
    const rejected = await listAttemptReports(ADMIN, { status: "REJECTED" });
    expect(rejected.items.map((item) => item.number)).toEqual(
      expect.arrayContaining(numbers.slice(0, 2)),
    );
    const row = rejected.items.find((item) => item.number === numbers[0])!;
    expect(row).toMatchObject({
      quizLabel: `${made[0]!.fixture.courseTitle} · Materi 1`,
      scorePercent: 50,
      answered: 2,
      total: 4,
      categoryLabel: "Halaman error saat mengirim jawaban",
      deadline: null,
    });
  });

  it("PENDING urut created_at asc, pemecah seri id", async () => {
    const fixture = await recoveryCourse("qo1");
    // Insert order r1, r2, r3; id order r1 < r3 < r2; expected order
    // r3, r2, r1 (created_at asc, tie on 2001-01-01 broken by id asc).
    const [r1, r2, r3] = await rawReports(fixture, [
      { createdAt: "2001-01-02T00:00:00Z", id: "00000000-0000-4000-8000-000000000001" },
      { createdAt: "2001-01-01T00:00:00Z", id: "00000000-0000-4000-8000-000000000003" },
      { createdAt: "2001-01-01T00:00:00Z", id: "00000000-0000-4000-8000-000000000002" },
    ]);
    const queue = await listAttemptReports(ADMIN, { status: "PENDING" });
    expect(queue.items.slice(0, 3).map((item) => item.number)).toEqual([r3, r2, r1]);
    expect(queue.items[0]!.deadline).toEqual({
      label: expect.stringMatching(/^lewat \d+ jam$/),
      urgent: true,
    });
  });

  it("batas 50 (laporan ke-51 yang terbaru tidak tampil)", async () => {
    const fixture = await recoveryCourse("ql1");
    const specs = Array.from({ length: 51 }, (_, index) => ({
      createdAt: new Date(Date.UTC(2010, 0, 1, 0, index)).toISOString(),
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    }));
    const numbers = await rawReports(fixture, specs, 100);
    const queue = await listAttemptReports(ADMIN, { status: "PENDING" });
    expect(queue.items).toHaveLength(50);
    const shown = new Set(queue.items.map((item) => item.number));
    expect(shown.has(numbers[0]!)).toBe(true);
    expect(shown.has(numbers[50]!)).toBe(false);
    expect(queue.counts.PENDING).toBeGreaterThanOrEqual(51);
  });
});

// --- review --------------------------------------------------------------------------

describe("getAttemptReportReview", () => {
  it("timeline dari DB, laporan ke-k, lalu keputusan read-only", async () => {
    const fixture = await recoveryCourse("rv1", "Rina Peninjauan");
    const first = await doLessonQuiz(fixture, 0, 2);
    const second = await doLessonQuiz(fixture, 1, 1);
    await createAttemptReport(fixture.member, first, REPORT);
    const { number } = await createAttemptReport(fixture.member, second, REPORT);

    const review = await getAttemptReportReview(ADMIN, number);
    expect(review).toMatchObject({
      number,
      status: "PENDING",
      reporter: { name: "Rina Peninjauan", ordinal: 2 },
      categoryLabel: "Halaman error saat mengirim jawaban",
      description: REPORT.description,
      attempt: {
        attemptNumber: 1,
        kind: "LESSON",
        lessonPosition: 2,
        contextLine: `${fixture.courseTitle} · Materi 2 · 4 soal · 10 menit`,
        scorePercent: 25,
        answered: 1,
        total: 4,
      },
      decision: null,
    });
    expect(review.deadline).toEqual({ label: "sisa 23 jam", urgent: false });
    expect(review.timeline.map((entry) => entry.label)).toEqual([
      "Quiz dimulai · 4 soal · batas 10 menit",
      "Jawaban soal 1 tersimpan",
      "Jawaban dikumpulkan · nilai 25",
    ]);

    await decideAttemptReport(ADMIN, number, {
      decision: "REJECT",
      reason: "Jawaban terkirim normal menurut catatan.",
      internalNote: "Cek ulang besok.",
    });
    const decided = await getAttemptReportReview(ADMIN, number);
    expect(decided.deadline).toBeNull();
    expect(decided.decision).toMatchObject({
      status: "REJECTED",
      reason: "Jawaban terkirim normal menurut catatan.",
      internalNote: "Cek ulang besok.",
      decidedByName: "Admin Pemulihan",
    });
    await expect(getAttemptReportReview(ADMIN, 2_000_000_000)).rejects.toThrow(
      NotFoundError,
    );
  });
});

// --- role ------------------------------------------------------------------------------

describe("role", () => {
  it("EDITOR dan MEMBER → ForbiddenError untuk semua fungsi admin, sebelum parse", async () => {
    const member = await newMember("rl1");
    for (const actor of [EDITOR, member]) {
      // Invalid inputs on purpose: a parse-first service would throw a
      // ZodError instead.
      await expect(listAttemptReports(actor, {})).rejects.toThrow(ForbiddenError);
      await expect(getAttemptReportReview(actor, "x")).rejects.toThrow(ForbiddenError);
      await expect(decideAttemptReport(actor, "x", {})).rejects.toThrow(ForbiddenError);
      await expect(findUserForManualReset(actor, {})).rejects.toThrow(ForbiddenError);
      await expect(resetAttemptManually(actor, "x", {})).rejects.toThrow(ForbiddenError);
    }
  });
});
