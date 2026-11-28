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
  courses,
  questionOptions,
  questions,
  quizAttempts,
  quizzes,
  users,
} from "@/db/schema";
import { createCourse } from "@/modules/course/service";
import { createLesson } from "@/modules/lesson/service";
import { enrollInCourse } from "@/modules/progress/service";

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
  saveQuizAnswer,
  startFinalQuiz,
  startLessonQuiz,
  submitQuizAttempt,
} from "@/modules/attempt/service";

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
