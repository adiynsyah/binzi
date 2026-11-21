// Integration tests for the attempt module (card S3-01) over PGlite — same
// harness as the progress module's lesson-page.integration.test.ts:
// committed Drizzle migrations on a fresh in-memory database, direct user
// inserts, real course/lesson services to build rows, direct quiz/question
// inserts (the CMS editor is out of scope for this card), then the REAL
// attempt + progress services.
//
// Covers the card's integration "Selesai jika":
// - getLessonQuizPage: aturan → berjalan → kedaluwarsa → hasil, kembali for
//   the video gate AND a locked lesson, 404s (unknown slugs, no-quiz
//   lesson, not enrolled), and the GET never finalizing an expired attempt.
// - startLessonQuiz: one attempt row with locked question_order and
//   server-computed expiry; the SEQUENTIAL double-start (index guard);
//   shuffle permutation; the ≥ 90 % eligibility boundary; 409 after any
//   final attempt; 404/409 gate errors.
// - saveQuizAnswer: upsert + change, saved answer has is_correct NULL
//   (V-01), ownership 404 (mutation 2), membership 404s, 409 after submit,
//   the 15-second tolerance both sides (mutation 3).
// - submitQuizAttempt: grading incl. unanswered-as-wrong and max_score over
//   ALL of question_order (mutation 7), the passing boundary, idempotency
//   WITHOUT regrading (mutation 4), EXPIRED past the tolerance (mutation
//   9), and the lesson_progress effects (mutation 8) + next-lesson unlock.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  courses,
  enrollments,
  lessonProgress,
  lessons,
  questionOptions,
  questions,
  quizAnswers,
  quizAttempts,
  quizzes,
  users,
} from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { createCourse } from "@/modules/course/service";
import { createLesson } from "@/modules/lesson/service";
import {
  enrollInCourse,
  getLessonPage,
  lessonHref,
  recordFinalQuizResult,
} from "@/modules/progress/service";

// Same "@/db" Proxy swap as the progress integration tests (queries.ts
// pulls the singleton; the tests point it at PGlite).
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
  getFinalQuizPage,
  getGradesPage,
  getLessonQuizPage,
  saveQuizAnswer,
  startFinalQuiz,
  startLessonQuiz,
  submitQuizAttempt,
} from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

const EDITOR = {
  id: "u-editor",
  role: "EDITOR" as const,
  status: "ACTIVE" as const,
};
const MEMBER = {
  id: "u-member",
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
};
const MEMBER_B = {
  id: "u-member-b",
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
};

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
      name: "Editor Satu",
      email: "editor@example.com",
      emailVerified: true,
      role: "EDITOR",
    },
    {
      id: MEMBER.id,
      name: "Member Satu",
      email: "member@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
    {
      id: MEMBER_B.id,
      name: "Member Dua",
      email: "member-b@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
  ]);
});

afterAll(async () => {
  await pglite.close();
});

// --- data builders -------------------------------------------------------

let counter = 0;
function nextPair(prefix: string): { title: string; slug: string } {
  counter += 1;
  return {
    title: `${prefix} kursu ${counter}`,
    slug: `${prefix}-kursu-${counter}`,
  };
}

/** A question spec for insertQuizOnLesson: options in storage order, the
 *  key by index. `explanation: null` keeps the db column NULL. */
type QuestionSpec = {
  type?: "SINGLE_CHOICE" | "TRUE_FALSE";
  points?: number;
  explanation?: string | null;
  options: { text: string; isCorrect: boolean }[];
};

/** The graded fixture: q1 (2 p, key A), q2 TRUE_FALSE (1 p, key Benar),
 *  q3 (3 p, key C), q4 (1 p, key B) — answer q1 correct + q2 wrong, leave
 *  q3/q4 untouched → score 2 of max 7 = 28.57 %. */
const GRADED_QUESTIONS: QuestionSpec[] = [
  {
    points: 2,
    explanation: "Pembahasan satu.",
    options: [
      { text: "Opsi satu A", isCorrect: true },
      { text: "Opsi satu B", isCorrect: false },
      { text: "Opsi satu C", isCorrect: false },
      { text: "Opsi satu D", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    points: 1,
    explanation: "Pembahasan dua.",
    options: [
      { text: "Benar", isCorrect: true },
      { text: "Salah", isCorrect: false },
    ],
  },
  {
    points: 3,
    explanation: "Pembahasan tiga.",
    options: [
      { text: "Opsi tiga A", isCorrect: false },
      { text: "Opsi tiga B", isCorrect: false },
      { text: "Opsi tiga C", isCorrect: true },
      { text: "Opsi tiga D", isCorrect: false },
    ],
  },
  {
    points: 1,
    explanation: "Pembahasan empat.",
    options: [
      { text: "Opsi empat A", isCorrect: false },
      { text: "Opsi empat B", isCorrect: true },
      { text: "Opsi empat C", isCorrect: false },
      { text: "Opsi empat D", isCorrect: false },
    ],
  },
];

/** Insert a quiz + questions and attach it to the lesson at `lessonIndex`.
 *  Shuffle flags default OFF so question_order assertions are exact. */
async function attachQuiz(
  lessonId: string,
  options: {
    questions?: QuestionSpec[];
    durationMinutes?: number;
    passingScorePercent?: number;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    explanationPolicy?: "ALWAYS" | "ON_PASS_ONLY" | "NEVER";
  } = {},
) {
  const [quiz] = await db
    .insert(quizzes)
    .values({
      type: "LESSON",
      title: `Quiz materi ${lessonId.slice(0, 8)}`,
      durationMinutes: options.durationMinutes ?? 5,
      passingScorePercent: options.passingScorePercent ?? 70,
      shuffleQuestions: options.shuffleQuestions ?? false,
      shuffleOptions: options.shuffleOptions ?? false,
      explanationPolicy: options.explanationPolicy ?? "ALWAYS",
    })
    .returning();
  const specs = options.questions ?? GRADED_QUESTIONS;
  const questionIds: string[] = [];
  const optionIds: string[][] = [];
  for (const [index, spec] of specs.entries()) {
    const [question] = await db
      .insert(questions)
      .values({
        quizId: quiz!.id,
        orderIndex: index + 1,
        type: spec.type ?? "SINGLE_CHOICE",
        text: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Soal nomor ${index + 1}` }],
            },
          ],
        },
        explanation:
          spec.explanation === undefined || typeof spec.explanation === "string"
            ? {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text:
                          spec.explanation ?? `Pembahasan ${index + 1}`,
                      },
                    ],
                  },
                ],
              }
            : null,
        points: spec.points ?? 1,
      })
      .returning();
    questionIds.push(question!.id);
    const ids: string[] = [];
    for (const [optionIndex, option] of spec.options.entries()) {
      const [row] = await db
        .insert(questionOptions)
        .values({
          questionId: question!.id,
          orderIndex: optionIndex,
          text: option.text,
          isCorrect: option.isCorrect,
        })
        .returning();
      ids.push(row!.id);
    }
    optionIds.push(ids);
  }
  await db.update(lessons).set({ quizId: quiz!.id }).where(eq(lessons.id, lessonId));
  return { quiz: quiz!, questionIds, optionIds };
}

/** PUBLISHED sequential course, MEMBER enrolled, quiz on lesson 1. */
async function quizCourse(
  prefix: string,
  options: Parameters<typeof attachQuiz>[1] = {},
  lessonTitles: string[] = ["Materi alpha", "Materi beta"],
) {
  const { title, slug } = nextPair(prefix);
  const course = await createCourse(EDITOR, {
    title,
    slug,
    level: "BEGINNER",
    summary: "Ringkasan netral untuk tes.",
  });
  const lessonRows = [];
  for (const lessonTitle of lessonTitles) {
    lessonRows.push(await createLesson(EDITOR, course.id, { title: lessonTitle }));
  }
  await db.update(courses).set({ status: "PUBLISHED" }).where(eq(courses.id, course.id));
  await enrollInCourse(MEMBER, course.id);
  const attached = await attachQuiz(lessonRows[0]!.id, options);
  return { course, slug, lessons: lessonRows, ...attached };
}

/** Make lesson 1's video READY with a stored watched percent. */
async function seedWatchedPercent(
  lessonId: string,
  percent: string,
  userId = MEMBER.id,
) {
  await db
    .update(lessons)
    .set({
      videoStatus: "READY",
      videoProvider: "YOUTUBE",
      videoExternalId: "e2eVideo001",
      videoDurationSeconds: 100,
    })
    .where(eq(lessons.id, lessonId));
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(sql`${enrollments.userId} = ${userId}`);
  await db
    .insert(lessonProgress)
    .values({
      userId,
      lessonId,
      enrollmentId: enrollment!.id,
      videoWatchedPercent: percent,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { videoWatchedPercent: percent },
    });
}

async function attemptRow(attemptId: string) {
  const [row] = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId));
  return row;
}

async function answerRows(attemptId: string) {
  return db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, attemptId));
}

async function progressRowOf(userId: string, lessonId: string) {
  const [row] = await db
    .select()
    .from(lessonProgress)
    .where(
      sql`${lessonProgress.userId} = ${userId} and ${lessonProgress.lessonId} = ${lessonId}`,
    );
  return row;
}

/** Push the attempt past the tolerance window (expires 20 s ago). */
async function expireAttempt(attemptId: string) {
  await db
    .update(quizAttempts)
    .set({ expiresAt: new Date(Date.now() - 20_000) })
    .where(eq(quizAttempts.id, attemptId));
}

/** Pull the attempt back to "10 s ago" — inside the 15 s tolerance. */
async function toleranceEdgeAttempt(attemptId: string) {
  await db
    .update(quizAttempts)
    .set({ expiresAt: new Date(Date.now() - 10_000) })
    .where(eq(quizAttempts.id, attemptId));
}

// --- getLessonQuizPage -----------------------------------------------------

describe("getLessonQuizPage — aturan", () => {
  it("no live attempt → the rules DTO (with the boundary allSingleChoice false)", async () => {
    const made = await quizCourse("qp1");
    const dto = await getLessonQuizPage(MEMBER, made.slug, made.lessons[0]!.slug);
    expect(dto).toEqual({
      state: "aturan",
      lessonId: made.lessons[0]!.id,
      quizTitle: made.quiz.title,
      lessonPosition: 1,
      lessonTitle: made.lessons[0]!.title,
      questionCount: 4,
      durationMinutes: 5,
      passingScorePercent: 70,
      explanationPolicy: "ALWAYS",
      // The fixture's q2 is TRUE_FALSE → rule 01 says "benar/salah".
      allSingleChoice: false,
      lessonHref: lessonHref(made.slug, made.lessons[0]!.slug),
    });
  });

  it("all SINGLE_CHOICE questions → allSingleChoice true", async () => {
    const made = await quizCourse("qp2", {
      questions: [
        {
          points: 1,
          options: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        },
        {
          points: 1,
          options: [
            { text: "A", isCorrect: false },
            { text: "B", isCorrect: true },
          ],
        },
      ],
    });
    const dto = await getLessonQuizPage(MEMBER, made.slug, made.lessons[0]!.slug);
    expect(dto.state).toBe("aturan");
    if (dto.state !== "aturan") return;
    expect(dto.allSingleChoice).toBe(true);
    expect(dto.questionCount).toBe(2);
  });
});

describe("getLessonQuizPage — berjalan / kedaluwarsa", () => {
  it("IN_PROGRESS inside the tolerance → running DTO, no grading keys, answers mapped", async () => {
    const made = await quizCourse("qp3");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![0]!,
    });

    const dto = await getLessonQuizPage(MEMBER, made.slug, made.lessons[0]!.slug);
    expect(dto.state).toBe("berjalan");
    if (dto.state !== "berjalan") return;
    expect(dto.heading).toBe(`Quiz Materi 1 · ${made.lessons[0]!.title}`);
    expect(dto.attemptId).toBe(attemptId);
    expect(dto.questions).toHaveLength(4);
    // Storage order (shuffle off) + numbering.
    expect(dto.questions.map((question) => question.id)).toEqual(
      made.questionIds,
    );
    expect(dto.questions[0]!.options.map((option) => option.label)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(dto.answers).toEqual({
      [made.questionIds[0]!]: made.optionIds[0]![0]!,
    });
    // V-01, recursively: no key column, no explanation text, no points.
    expect(JSON.stringify(dto)).not.toContain("isCorrect");
    expect(JSON.stringify(dto)).not.toContain("Pembahasan");
    expect(dto.questions.every((question) => !("points" in question))).toBe(
      true,
    );
  });

  it("IN_PROGRESS past the tolerance → kedaluwarsa, and the GET does NOT finalize (mutation 13)", async () => {
    const made = await quizCourse("qp4");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await expireAttempt(attemptId);

    const dto = await getLessonQuizPage(MEMBER, made.slug, made.lessons[0]!.slug);
    expect(dto).toEqual({ state: "kedaluwarsa", attemptId });
    // Decision 6: a GET never writes — the row is still IN_PROGRESS; only
    // the beacon's submit finalizes it (as EXPIRED).
    expect((await attemptRow(attemptId))!.status).toBe("IN_PROGRESS");
    expect((await attemptRow(attemptId))!.submittedAt).toBeNull();
  });
});

describe("getLessonQuizPage — hasil", () => {
  it("after submit → the result DTO with policy-shown key + next lesson", async () => {
    const made = await quizCourse("qp5");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![0]!, // correct
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[1]!,
      optionId: made.optionIds[1]![1]!, // wrong (key is index 0)
    });
    await submitQuizAttempt(MEMBER, { attemptId });

    const dto = await getLessonQuizPage(MEMBER, made.slug, made.lessons[0]!.slug);
    expect(dto.state).toBe("hasil");
    if (dto.state !== "hasil") return;
    expect(dto.status).toBe("SUBMITTED");
    expect(dto.scorePercent).toBe(28); // 2/7 = 28.57 FLOORS to 28 (S3-02 §3)
    expect(dto.isPassed).toBe(false);
    expect(dto.correct).toBe(1);
    expect(dto.wrong).toBe(1);
    expect(dto.unanswered).toBe(2);
    expect(dto.lesson).toEqual({
      position: 1,
      title: made.lessons[0]!.title,
      href: lessonHref(made.slug, made.lessons[0]!.slug),
    });
    expect(dto.next).toEqual({
      position: 2,
      href: lessonHref(made.slug, made.lessons[1]!.slug),
    });
    // ALWAYS policy: the key and the explanation show after submit.
    expect(dto.items[0]!.options[0]!.correct).toBe(true);
    expect(dto.items[0]!.explanation).toBe("Pembahasan satu.");
    // The same option order as the running screen (seeded, shuffle off).
    expect(dto.items[0]!.options.map((option) => option.text)).toEqual([
      "Opsi satu A",
      "Opsi satu B",
      "Opsi satu C",
      "Opsi satu D",
    ]);
  });

  it("NEVER policy hides both the key and the explanation on the result screen", async () => {
    const made = await quizCourse("qp6", { explanationPolicy: "NEVER" });
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![0]!,
    });
    await submitQuizAttempt(MEMBER, { attemptId });
    const dto = await getLessonQuizPage(MEMBER, made.slug, made.lessons[0]!.slug);
    if (dto.state !== "hasil") throw new Error("expected hasil");
    expect(dto.items.every((item) => item.explanation === null)).toBe(true);
    expect(
      dto.items.every((item) =>
        item.options.every((option) => option.correct === null),
      ),
    ).toBe(true);
  });
});

describe("getLessonQuizPage — kembali + 404s", () => {
  it("READY video at 89 % → kembali to the lesson page", async () => {
    const made = await quizCourse("qp7");
    await seedWatchedPercent(made.lessons[0]!.id, "89.00");
    const dto = await getLessonQuizPage(MEMBER, made.slug, made.lessons[0]!.slug);
    expect(dto).toEqual({
      state: "kembali",
      href: lessonHref(made.slug, made.lessons[0]!.slug),
    });
  });

  it("a locked lesson's quiz page → kembali (the lesson page owns the state)", async () => {
    const made = await quizCourse("qp8"); // sequential: lesson 2 locked
    // Attach a quiz to lesson 2 as well, so the ONLY blocker is the gate.
    await attachQuiz(made.lessons[1]!.id, {
      questions: GRADED_QUESTIONS.slice(0, 1),
    });
    const dto = await getLessonQuizPage(MEMBER, made.slug, made.lessons[1]!.slug);
    expect(dto).toEqual({
      state: "kembali",
      href: lessonHref(made.slug, made.lessons[1]!.slug),
    });
  });

  it("unknown course slug, unknown lesson slug, an UNPUBLISHED course, and a quiz-less lesson all answer 404", async () => {
    await expect(
      getLessonQuizPage(MEMBER, "kursus-tak-ada", "apapun"),
    ).rejects.toThrow(NotFoundError);

    const made = await quizCourse("qp9");
    await expect(
      getLessonQuizPage(MEMBER, made.slug, "materi-tak-ada"),
    ).rejects.toThrow(NotFoundError);

    // Card S3-02 decision 5: an unpublished course STAYS a 404 — the slug
    // lookup runs before the not-enrolled catch, so it can never redirect.
    const draft = await quizCourse("qp10");
    await db
      .update(courses)
      .set({ status: "DRAFT" })
      .where(eq(courses.id, draft.course.id));
    await expect(
      getLessonQuizPage(MEMBER, draft.slug, draft.lessons[0]!.slug),
    ).rejects.toThrow(NotFoundError);

    const bare = await quizCourse("qp11");
    await db
      .update(lessons)
      .set({ quizId: null })
      .where(eq(lessons.id, bare.lessons[0]!.id));
    await expect(
      getLessonQuizPage(MEMBER, bare.slug, bare.lessons[0]!.slug),
    ).rejects.toThrow(NotFoundError);
  });

  it("not enrolled → kembali to the lesson page, NOT a 404 (card S3-02 §6)", async () => {
    // The lesson slug resolves and the course is PUBLISHED — only the
    // enrollment is missing, and the LESSON page owns that state.
    const lone = await quizCourse("qp12");
    const dto = await getLessonQuizPage(
      MEMBER_B,
      lone.slug,
      lone.lessons[0]!.slug,
    );
    expect(dto).toEqual({
      state: "kembali",
      href: lessonHref(lone.slug, lone.lessons[0]!.slug),
    });
  });
});

// --- startLessonQuiz ---------------------------------------------------------

describe("startLessonQuiz", () => {
  it("creates ONE attempt with locked order and server-computed expiry", async () => {
    const made = await quizCourse("st1", { durationMinutes: 7 });
    const result = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    expect(result.created).toBe(true);

    const row = await attemptRow(result.attemptId);
    expect(row!.status).toBe("IN_PROGRESS");
    expect(row!.attemptNumber).toBe(1);
    expect(row!.questionOrder).toEqual(made.questionIds);
    expect(row!.enrollmentId).toBeDefined();
    expect(
      row!.expiresAt.getTime() - row!.startedAt.getTime(),
    ).toBe(7 * 60_000);
  });

  it("a second start (SEQUENTIAL, the card's concurrency shape) continues the SAME attempt", async () => {
    const made = await quizCourse("st2");
    const first = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    const second = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    expect(second.created).toBe(false);
    expect(second.attemptId).toBe(first.attemptId);
    const rows = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, made.quiz.id));
    expect(rows).toHaveLength(1);
  });

  it("shuffle_questions on → question_order is a permutation of all question ids", async () => {
    const made = await quizCourse("st3", { shuffleQuestions: true });
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    const row = await attemptRow(attemptId);
    expect([...row!.questionOrder].sort()).toEqual(
      [...made.questionIds].sort(),
    );
    expect(row!.questionOrder).toHaveLength(made.questionIds.length);
  });

  it("the eligibility boundary: 89.99 → 409 with the exact copy, 90.00 → allowed (mutation 14)", async () => {
    const made = await quizCourse("st4");
    await seedWatchedPercent(made.lessons[0]!.id, "89.99");
    await expect(
      startLessonQuiz(MEMBER, { lessonId: made.lessons[0]!.id }),
    ).rejects.toThrow(new ConflictError(
      "Tonton video sampai minimal 90 % untuk membuka quiz.",
    ));

    const boundary = await quizCourse("st5");
    await seedWatchedPercent(boundary.lessons[0]!.id, "90.00");
    const result = await startLessonQuiz(MEMBER, {
      lessonId: boundary.lessons[0]!.id,
    });
    expect(result.created).toBe(true);
  });

  it("after a final attempt (SUBMITTED or EXPIRED) → 409 Quiz ini sudah dikerjakan (mutation 6)", async () => {
    const made = await quizCourse("st6");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await submitQuizAttempt(MEMBER, { attemptId });
    await expect(
      startLessonQuiz(MEMBER, { lessonId: made.lessons[0]!.id }),
    ).rejects.toThrow(new ConflictError("Quiz ini sudah dikerjakan."));

    const expired = await quizCourse("st7");
    const second = await startLessonQuiz(MEMBER, {
      lessonId: expired.lessons[0]!.id,
    });
    await expireAttempt(second.attemptId);
    await submitQuizAttempt(MEMBER, { attemptId: second.attemptId });
    await expect(
      startLessonQuiz(MEMBER, { lessonId: expired.lessons[0]!.id }),
    ).rejects.toThrow(new ConflictError("Quiz ini sudah dikerjakan."));
  });

  it("gate errors: locked lesson → 409, unknown/not-enrolled lesson → 404", async () => {
    const made = await quizCourse("st8"); // sequential, lesson 2 locked
    await expect(
      startLessonQuiz(MEMBER, { lessonId: made.lessons[1]!.id }),
    ).rejects.toThrow(ConflictError);
    await expect(
      startLessonQuiz(MEMBER, { lessonId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toThrow(NotFoundError);
  });
});

// --- saveQuizAnswer ------------------------------------------------------------

describe("saveQuizAnswer", () => {
  async function startedCourse(prefix: string) {
    const made = await quizCourse(prefix);
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    return { made, attemptId };
  }

  it("saves with is_correct NULL, upserts on change (one row per question)", async () => {
    const { made, attemptId } = await startedCourse("sv1");
    const first = await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![1]!,
    });
    expect(typeof first.savedAt).toBe("string");
    expect(Number.isNaN(Date.parse(first.savedAt))).toBe(false);

    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![2]!,
    });
    const rows = await answerRows(attemptId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.selectedOptionId).toBe(made.optionIds[0]![2]!);
    expect(rows[0]!.isCorrect).toBeNull(); // V-01: never graded at save time
    expect(rows[0]!.answeredAt).not.toBeNull();
  });

  it("another participant's attempt id → 404 (mutation 2), unknown attempt → 404", async () => {
    const { made, attemptId } = await startedCourse("sv2");
    await expect(
      saveQuizAnswer(MEMBER_B, {
        attemptId,
        questionId: made.questionIds[0]!,
        optionId: made.optionIds[0]![0]!,
      }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      saveQuizAnswer(MEMBER, {
        attemptId: "00000000-0000-4000-8000-000000000000",
        questionId: made.questionIds[0]!,
        optionId: made.optionIds[0]![0]!,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("a question outside question_order and an option of another question → the same 404", async () => {
    const { made, attemptId } = await startedCourse("sv3");
    await expect(
      saveQuizAnswer(MEMBER, {
        attemptId,
        questionId: "00000000-0000-4000-8000-000000000001",
        optionId: made.optionIds[0]![0]!,
      }),
    ).rejects.toThrow(new NotFoundError("Soal tidak ditemukan."));
    // q1's question with q2's option.
    await expect(
      saveQuizAnswer(MEMBER, {
        attemptId,
        questionId: made.questionIds[0]!,
        optionId: made.optionIds[1]![0]!,
      }),
    ).rejects.toThrow(new NotFoundError("Soal tidak ditemukan."));
  });

  it("after submit → 409", async () => {
    const { made, attemptId } = await startedCourse("sv4");
    await submitQuizAttempt(MEMBER, { attemptId });
    await expect(
      saveQuizAnswer(MEMBER, {
        attemptId,
        questionId: made.questionIds[0]!,
        optionId: made.optionIds[0]![0]!,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("the 15-second tolerance both ways (mutation 3)", async () => {
    const edge = await startedCourse("sv5");
    await toleranceEdgeAttempt(edge.attemptId); // expired 10 s ago
    await expect(
      saveQuizAnswer(MEMBER, {
        attemptId: edge.attemptId,
        questionId: edge.made.questionIds[0]!,
        optionId: edge.made.optionIds[0]![0]!,
      }),
    ).resolves.toMatchObject({ savedAt: expect.any(String) });

    const past = await startedCourse("sv6");
    await expireAttempt(past.attemptId); // expired 20 s ago
    await expect(
      saveQuizAnswer(MEMBER, {
        attemptId: past.attemptId,
        questionId: past.made.questionIds[0]!,
        optionId: past.made.optionIds[0]![0]!,
      }),
    ).rejects.toThrow(new ConflictError("Waktu quiz sudah habis."));
  });
});

// --- submitQuizAttempt ---------------------------------------------------------

describe("submitQuizAttempt — grading", () => {
  it("unanswered counts as wrong; max_score covers ALL of question_order (mutation 7)", async () => {
    const made = await quizCourse("sm1");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![0]!, // correct, 2 p
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[1]!,
      optionId: made.optionIds[1]![1]!, // wrong, 0 p
    });

    const result = await submitQuizAttempt(MEMBER, { attemptId });
    expect(result).toEqual({ status: "SUBMITTED" });

    const row = await attemptRow(attemptId);
    expect(row!.score).toBe(2);
    expect(row!.maxScore).toBe(7); // 2+1+3+1 — q3/q4 unanswered still count
    expect(row!.scorePercent).toBe("28.57");
    expect(row!.isPassed).toBe(false);
    expect(row!.submittedAt).not.toBeNull();

    const saved = await answerRows(attemptId);
    expect(saved).toHaveLength(2);
    const q1 = saved.find((r) => r.questionId === made.questionIds[0]!)!;
    const q2 = saved.find((r) => r.questionId === made.questionIds[1]!)!;
    expect(q1.isCorrect).toBe(true);
    expect(q1.pointsEarned).toBe(2);
    expect(q2.isCorrect).toBe(false);
    expect(q2.pointsEarned).toBe(0);
  });

  it("the passing boundary is >= (exactly 70.00 passes)", async () => {
    const made = await quizCourse(
      "sm2",
      {
        passingScorePercent: 70,
        questions: [
          {
            points: 7,
            options: [
              { text: "Kunci", isCorrect: true },
              { text: "Salah", isCorrect: false },
            ],
          },
          {
            points: 3,
            options: [
              { text: "Salah", isCorrect: false },
              { text: "Kunci", isCorrect: true },
            ],
          },
        ],
      },
    );
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![0]!,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[1]!,
      optionId: made.optionIds[1]![0]!, // wrong
    });
    await submitQuizAttempt(MEMBER, { attemptId });
    const row = await attemptRow(attemptId);
    expect(row!.scorePercent).toBe("70.00");
    expect(row!.isPassed).toBe(true);
  });

  it("idempotent: a second submit returns the stored status WITHOUT regrading (mutation 4)", async () => {
    const made = await quizCourse("sm3");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![0]!, // correct
    });
    await submitQuizAttempt(MEMBER, { attemptId });

    // Sneak a "better" answer in AFTER the fact, then submit again.
    await db
      .update(quizAnswers)
      .set({ selectedOptionId: made.optionIds[2]![2]! })
      .where(
        sql`${quizAnswers.attemptId} = ${attemptId} and ${quizAnswers.questionId} = ${made.questionIds[2]!}`,
      );
    // q3 was never answered → no row to sneak; insert one directly.
    await db.insert(quizAnswers).values({
      attemptId,
      questionId: made.questionIds[3]!,
      selectedOptionId: made.optionIds[3]![1]!,
    });

    const second = await submitQuizAttempt(MEMBER, { attemptId });
    expect(second).toEqual({ status: "SUBMITTED" });
    const row = await attemptRow(attemptId);
    expect(row!.score).toBe(2); // unchanged — no regrade
    expect(row!.submittedAt!.getTime()).toBe(
      (await attemptRow(attemptId))!.submittedAt!.getTime(),
    );
  });

  it("ownership: member B cannot submit A's attempt", async () => {
    const made = await quizCourse("sm4");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await expect(submitQuizAttempt(MEMBER_B, { attemptId })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("past the tolerance → EXPIRED, still graded, submitted_at set (mutation 9)", async () => {
    const made = await quizCourse("sm5");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![0]!,
    });
    await expireAttempt(attemptId);

    const result = await submitQuizAttempt(MEMBER, { attemptId });
    expect(result).toEqual({ status: "EXPIRED" });
    const row = await attemptRow(attemptId);
    expect(row!.score).toBe(2);
    expect(row!.scorePercent).toBe("28.57");
    expect(row!.submittedAt).not.toBeNull();
  });
});

describe("submitQuizAttempt — lesson_progress effects", () => {
  it("no-READY-video lesson: quiz_attempted + score columns + COMPLETED (mutation 8)", async () => {
    const made = await quizCourse("sp1");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: made.questionIds[0]!,
      optionId: made.optionIds[0]![0]!, // correct, 2 of 7
    });
    await submitQuizAttempt(MEMBER, { attemptId });

    const row = await progressRowOf(MEMBER.id, made.lessons[0]!.id);
    expect(row).toBeDefined();
    expect(row!.quizAttempted).toBe(true);
    expect(row!.quizScorePercent).toBe("28.57");
    expect(row!.quizIsPassed).toBe(false);
    expect(row!.quizSubmittedAt).not.toBeNull();
    expect(row!.status).toBe("COMPLETED");
    expect(row!.completedAt).not.toBeNull();
  });

  it("video becomes READY mid-attempt at 50 %: quiz recorded, status stays IN_PROGRESS", async () => {
    // The divergent case the COMPLETED-only-if-video-met rule exists for:
    // the quiz started while the lesson had no video (eligible at once),
    // and a READY video with unmet watch percent exists by submit time.
    const made = await quizCourse("sp2");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await seedWatchedPercent(made.lessons[0]!.id, "50.00");
    await submitQuizAttempt(MEMBER, { attemptId });
    const row = await progressRowOf(MEMBER.id, made.lessons[0]!.id);
    expect(row!.quizAttempted).toBe(true);
    expect(row!.status).toBe("IN_PROGRESS");
    expect(row!.completedAt).toBeNull();
  });

  it("READY video at 90 %: COMPLETED once the quiz lands", async () => {
    const made = await quizCourse("sp3");
    await seedWatchedPercent(made.lessons[0]!.id, "95.00");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await submitQuizAttempt(MEMBER, { attemptId });
    const row = await progressRowOf(MEMBER.id, made.lessons[0]!.id);
    expect(row!.status).toBe("COMPLETED");
    expect(row!.completedAt).not.toBeNull();
  });

  it("the submit unlocks the NEXT lesson of a sequential course (the gate reads quiz_attempted)", async () => {
    const made = await quizCourse("sp4");
    const before = await getLessonPage(MEMBER, made.slug, made.lessons[1]!.slug);
    expect(before.state).toBe("locked");

    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await submitQuizAttempt(MEMBER, { attemptId });

    const after = await getLessonPage(MEMBER, made.slug, made.lessons[1]!.slug);
    expect(after.state).toBe("open");
  });
});

// --- reset (QZ-19 rehearsal) & attempt-vs-gate priority -------------------

describe("reset & gate priority (owner review of PR 138)", () => {
  it("after the rehearsal-SQL reset: aturan again, then a NEW attempt numbered 2", async () => {
    const made = await quizCourse("rs1");
    const first = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await submitQuizAttempt(MEMBER, { attemptId: first.attemptId });
    expect((await attemptRow(first.attemptId))!.status).toBe("SUBMITTED");

    // The card's "Catatan untuk gladi" SQL, shape for shape: the attempt
    // row is STAMPED reset_at (history, never deleted — PRD §11.4) and
    // lesson_progress's quiz columns are wiped.
    await db
      .update(quizAttempts)
      .set({
        resetAt: new Date(),
        resetReason: "gladi resik",
        resetBy: EDITOR.id,
      })
      .where(
        and(
          eq(quizAttempts.userId, MEMBER.id),
          eq(quizAttempts.quizId, made.quiz.id),
          sql`${quizAttempts.resetAt} is null`,
        ),
      );
    await db
      .update(lessonProgress)
      .set({
        quizAttempted: false,
        quizScorePercent: null,
        quizIsPassed: null,
        quizSubmittedAt: null,
        status: "IN_PROGRESS",
        completedAt: null,
      })
      .where(
        and(
          eq(lessonProgress.userId, MEMBER.id),
          eq(lessonProgress.lessonId, made.lessons[0]!.id),
        ),
      );

    const page = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    expect(page.state).toBe("aturan");

    const second = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    expect(second.created).toBe(true);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect((await attemptRow(second.attemptId))!.attemptNumber).toBe(2);
  });

  it("a READY video attached AFTER submit stays on hasil — the gate guards the first start only", async () => {
    const made = await quizCourse("vg1");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await submitQuizAttempt(MEMBER, { attemptId });
    // 10 % watched would fail the ≥ 90 % gate were it still consulted.
    await seedWatchedPercent(made.lessons[0]!.id, "10.00");
    const page = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    expect(page.state).toBe("hasil");
    // A start still answers the ONE-ATTEMPT 409, never the video 409.
    await expect(
      startLessonQuiz(MEMBER, { lessonId: made.lessons[0]!.id }),
    ).rejects.toThrow(new ConflictError("Quiz ini sudah dikerjakan."));
  });
});

// --------------------------------------------------------------------------
// Final Quiz (card S5-02). Same harness: createCourse attaches the FINAL
// quiz, the builder completes every lesson with a score, and the real
// start/submit paths run against PGlite.
// --------------------------------------------------------------------------

/** Set the score weights (system_settings, S1-09 shape; raw upsert — the
 *  S1-09 integration file uses the same pglite.query shape). */
async function seedScoreWeights(lesson: number, final: number): Promise<void> {
  for (const [key, value] of [
    ["score.lesson_weight", lesson],
    ["score.final_weight", final],
  ] as const) {
    await pglite.query(
      `insert into system_settings (key, value)
       values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [key, JSON.stringify(value)],
    );
  }
}

/** Simple 1-point single-choice questions for the FINAL quiz. */
function finalQuestions(count: number): QuestionSpec[] {
  return Array.from({ length: count }, (_, index) => ({
    points: 1,
    explanation: `Pembahasan final ${index + 1}.`,
    options: [
      { text: `Opsi final A ${index + 1}`, isCorrect: true },
      { text: `Opsi final B ${index + 1}`, isCorrect: false },
      { text: `Opsi final C ${index + 1}`, isCorrect: false },
    ],
  }));
}

/** Fill the FINAL quiz with `count` questions and answer key ids. */
async function fillFinalQuiz(
  finalQuizId: string,
  specs: QuestionSpec[],
): Promise<{ questionIds: string[]; correctOptionIds: string[] }> {
  const questionIds: string[] = [];
  const correctOptionIds: string[] = [];
  for (const [index, spec] of specs.entries()) {
    const [question] = await db
      .insert(questions)
      .values({
        quizId: finalQuizId,
        orderIndex: index + 1,
        type: "SINGLE_CHOICE",
        text: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Soal final ${index + 1}` }],
            },
          ],
        },
        explanation: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: spec.explanation ?? "-" }],
            },
          ],
        },
        points: spec.points ?? 1,
      })
      .returning();
    questionIds.push(question!.id);
    let correct: string | null = null;
    for (const [optionIndex, option] of spec.options.entries()) {
      const [row] = await db
        .insert(questionOptions)
        .values({
          questionId: question!.id,
          orderIndex: optionIndex,
          text: option.text,
          isCorrect: option.isCorrect,
        })
        .returning();
      if (option.isCorrect) correct = row!.id;
    }
    correctOptionIds.push(correct!);
  }
  return { questionIds, correctOptionIds };
}

/** Complete ONE lesson with a quiz score (direct lesson_progress write —
 *  the lesson-quiz path itself is covered by the S3-01 tests above).
 *  Card S5-03 §"Berkas": optional stored verdict/timestamp without
 *  changing any old caller. */
async function completeLessonWithScore(
  userId: string,
  courseId: string,
  lessonId: string,
  scorePercent: string,
  options: { quizIsPassed?: boolean | null; quizSubmittedAt?: Date | null } = {},
) {
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      sql`${enrollments.userId} = ${userId} and ${enrollments.courseId} = ${courseId}`,
    );
  await db
    .insert(lessonProgress)
    .values({
      userId,
      lessonId,
      enrollmentId: enrollment!.id,
      status: "COMPLETED",
      quizAttempted: true,
      quizScorePercent: scorePercent,
      quizIsPassed: options.quizIsPassed ?? null,
      quizSubmittedAt: options.quizSubmittedAt ?? null,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        status: "COMPLETED",
        quizAttempted: true,
        quizScorePercent: scorePercent,
        quizIsPassed: options.quizIsPassed ?? null,
        quizSubmittedAt: options.quizSubmittedAt ?? null,
      },
    });
}

/**
 * The Final fixture: PUBLISHED 2-lesson course (createCourse's FINAL quiz
 * filled with `questionCount` 1-point questions, shuffle off), MEMBER
 * enrolled, every lesson COMPLETED with its score.
 */
async function finalCourse(
  prefix: string,
  options: {
    lessonScores?: [string, string] | [string];
    questionCount?: number;
    passingScorePercent?: number;
    enroll?: boolean;
    complete?: boolean;
  } = {},
) {
  await seedScoreWeights(60, 40);
  const { title, slug } = nextPair(prefix);
  const course = await createCourse(EDITOR, {
    title,
    slug,
    level: "BEGINNER",
    summary: "Ringkasan netral untuk tes.",
  });
  const lessonRows = [
    await createLesson(EDITOR, course.id, { title: "Materi alpha" }),
    await createLesson(EDITOR, course.id, { title: "Materi beta" }),
  ];
  const [courseRow] = await db
    .select({ finalQuizId: courses.finalQuizId })
    .from(courses)
    .where(eq(courses.id, course.id));
  if (!courseRow?.finalQuizId) throw new Error("course without FINAL quiz");
  await db
    .update(quizzes)
    .set({
      title: `Final Quiz ${title}`,
      durationMinutes: 20,
      passingScorePercent: options.passingScorePercent ?? 70,
      shuffleQuestions: false,
      shuffleOptions: false,
    })
    .where(eq(quizzes.id, courseRow.finalQuizId));
  const filled = await fillFinalQuiz(
    courseRow.finalQuizId,
    finalQuestions(options.questionCount ?? 5),
  );
  await db.update(courses).set({ status: "PUBLISHED" }).where(eq(courses.id, course.id));
  if (options.enroll ?? true) {
    await enrollInCourse(MEMBER, course.id);
  }
  if (options.complete ?? true) {
    const scores = options.lessonScores ?? ["70.00", "50.00"];
    const toComplete = scores.length === 2 ? lessonRows : [lessonRows[0]!];
    for (const [index, lesson] of toComplete.entries()) {
      await completeLessonWithScore(
        MEMBER.id,
        course.id,
        lesson.id,
        scores[index]!,
      );
    }
  }
  return {
    course,
    slug,
    lessons: lessonRows,
    finalQuizId: courseRow.finalQuizId,
    ...filled,
  };
}

/** Save `correctCount` correct answers then `wrongCount` wrong ones on the
 *  following questions (the rest stay unanswered). Card S5-03: optional
 *  trailing actor (defaults to MEMBER) so grades tests never touch the
 *  shared fixtures' attempts. */
async function answerFinalAttempt(
  attemptId: string,
  correctOptionIds: string[],
  optionRowsAll: { questionId: string; id: string; isCorrect: boolean }[],
  correctCount: number,
  wrongCount: number,
  actor: typeof MEMBER = MEMBER,
) {
  const questionOf = (optionId: string) =>
    optionRowsAll.find((row) => row.id === optionId)!.questionId;
  const wrongOptionOf = (questionId: string) =>
    optionRowsAll.find(
      (row) => row.questionId === questionId && !row.isCorrect,
    )!.id;
  for (let index = 0; index < correctCount; index += 1) {
    await saveQuizAnswer(actor, {
      attemptId,
      questionId: questionOf(correctOptionIds[index]!),
      optionId: correctOptionIds[index]!,
    });
  }
  for (let index = 0; index < wrongCount; index += 1) {
    const questionId = questionOf(correctOptionIds[correctCount + index]!);
    await saveQuizAnswer(actor, {
      attemptId,
      questionId,
      optionId: wrongOptionOf(questionId),
    });
  }
}

async function enrollmentRow(userId: string, courseId: string) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(
      sql`${enrollments.userId} = ${userId} and ${enrollments.courseId} = ${courseId}`,
    );
  return row;
}

describe("getFinalQuizPage", () => {
  it("not enrolled → kembali at the FIRST lesson", async () => {
    const made = await finalCourse("fqa", { enroll: false, complete: false });
    const page = await getFinalQuizPage(MEMBER, made.slug);
    expect(page).toEqual({
      state: "kembali",
      href: `/belajar/${made.slug}/${made.lessons[0]!.slug}`,
    });
  });

  it("1 of 2 lessons COMPLETED, no attempt → kembali at the INCOMPLETE lesson", async () => {
    const made = await finalCourse("fqb", {
      lessonScores: ["70.00"],
    });
    const page = await getFinalQuizPage(MEMBER, made.slug);
    expect(page).toEqual({
      state: "kembali",
      href: `/belajar/${made.slug}/${made.lessons[1]!.slug}`,
    });
  });

  it("all COMPLETED, no attempt → aturan-final: average 60 (70,50), weights, pointers", async () => {
    const made = await finalCourse("fqc", { lessonScores: ["70.00", "50.00"] });
    const page = await getFinalQuizPage(MEMBER, made.slug);
    expect(page.state).toBe("aturan-final");
    if (page.state !== "aturan-final") return;
    expect(page.courseId).toBe(made.course.id);
    expect(page.courseTitle).toBe(made.course.title);
    expect(page.questionCount).toBe(5);
    expect(page.durationMinutes).toBe(20);
    expect(page.passingScorePercent).toBe(70);
    expect(page.lessonAveragePercent).toBe(60);
    expect(page.weights).toEqual({ lessonPercent: 60, finalPercent: 40 });
    expect(page.lastLessonHref).toBe(
      `/belajar/${made.slug}/${made.lessons[1]!.slug}`,
    );
    // The allowlist is exact (serializer proof, card "Selesai jika").
    expect(Object.keys(page).sort()).toEqual(
      [
        "state",
        "courseId",
        "courseTitle",
        "questionCount",
        "durationMinutes",
        "passingScorePercent",
        "lessonAveragePercent",
        "weights",
        "lastLessonHref",
      ].sort(),
    );
  });

  it("no final_quiz_id, unpublished, and unknown slug → the SAME 404", async () => {
    const made = await finalCourse("fqd");
    await db
      .update(courses)
      .set({ finalQuizId: null })
      .where(eq(courses.id, made.course.id));
    await expect(getFinalQuizPage(MEMBER, made.slug)).rejects.toThrow(
      NotFoundError,
    );

    const draft = await finalCourse("fqe", { enroll: false, complete: false });
    await db
      .update(courses)
      .set({ status: "DRAFT" })
      .where(eq(courses.id, draft.course.id));
    await expect(getFinalQuizPage(MEMBER, draft.slug)).rejects.toThrow(
      NotFoundError,
    );

    await expect(getFinalQuizPage(MEMBER, "slug-tidak-ada")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("an expired attempt → kedaluwarsa, and the GET does NOT finalize the row", async () => {
    const made = await finalCourse("fqf");
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await expireAttempt(attemptId);
    const page = await getFinalQuizPage(MEMBER, made.slug);
    expect(page).toEqual({ state: "kedaluwarsa", attemptId });
    expect((await attemptRow(attemptId))!.status).toBe("IN_PROGRESS");
  });

  it("a running attempt → berjalan with NO grading keys anywhere (recursive scan)", async () => {
    const made = await finalCourse("fqg");
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    const page = await getFinalQuizPage(MEMBER, made.slug);
    expect(page.state).toBe("berjalan");
    if (page.state !== "berjalan") return;
    expect(page.heading).toBe(`Final Quiz · ${made.course.title}`);
    expect(page.attemptId).toBe(attemptId);
    expect(page.questions).toHaveLength(5);
    const keys = new Set<string>();
    const scan = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(scan);
      else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          scan(child);
        }
      }
    };
    scan(page);
    expect(keys.has("isCorrect")).toBe(false);
    expect(keys.has("correct")).toBe(false);
    expect(keys.has("explanation")).toBe(false);
  });
});

describe("startFinalQuiz", () => {
  it("the gate: 1 of 2 lessons COMPLETED → 409 with the exact copy", async () => {
    const made = await finalCourse("fsa", { lessonScores: ["70.00"] });
    await expect(
      startFinalQuiz(MEMBER, { courseId: made.course.id }),
    ).rejects.toThrow(
      new ConflictError("Selesaikan semua materi untuk membuka Final Quiz."),
    );
  });

  it("all COMPLETED → creates ONE attempt on the FINAL quiz; a second start continues it", async () => {
    const made = await finalCourse("fsb");
    const first = await startFinalQuiz(MEMBER, { courseId: made.course.id });
    expect(first.created).toBe(true);
    const row = await attemptRow(first.attemptId);
    expect(row!.quizId).toBe(made.finalQuizId);
    expect(row!.status).toBe("IN_PROGRESS");

    const second = await startFinalQuiz(MEMBER, { courseId: made.course.id });
    expect(second.created).toBe(false);
    expect(second.attemptId).toBe(first.attemptId);
  });

  it("after submit → 409 Final Quiz ini sudah dikerjakan (one attempt forever)", async () => {
    const made = await finalCourse("fsc");
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await submitQuizAttempt(MEMBER, { attemptId });
    await expect(
      startFinalQuiz(MEMBER, { courseId: made.course.id }),
    ).rejects.toThrow(new ConflictError("Final Quiz ini sudah dikerjakan."));
  });

  it("not enrolled → the uniform 404 (an unknown course reads the same)", async () => {
    const made = await finalCourse("fsd", { enroll: false, complete: false });
    await expect(
      startFinalQuiz(MEMBER, { courseId: made.course.id }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      startFinalQuiz(MEMBER, {
        courseId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("submitQuizAttempt — FINAL branch (Nilai Akhir)", () => {
  /** Option rows of the final quiz with questionId + isCorrect, for the
   *  answer helpers. */
  async function finalOptions(made: {
    finalQuizId: string;
    correctOptionIds: string[];
  }) {
    const rows = await db
      .select({
        questionId: questionOptions.questionId,
        id: questionOptions.id,
        isCorrect: questionOptions.isCorrect,
      })
      .from(questionOptions)
      .innerJoin(questions, eq(questionOptions.questionId, questions.id))
      .where(eq(questions.quizId, made.finalQuizId));
    return rows;
  }

  it("data A: 70+50, final 80 % ≥ 70 → final_score 68.00, PASSED, completed_at set", async () => {
    const made = await finalCourse("fta", { lessonScores: ["70.00", "50.00"] });
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptions(made),
      4,
      1,
    );
    const result = await submitQuizAttempt(MEMBER, { attemptId });
    expect(result.status).toBe("SUBMITTED");
    const attempt = await attemptRow(attemptId);
    expect(attempt!.scorePercent).toBe("80.00");
    expect(attempt!.isPassed).toBe(true);

    const enrollment = await enrollmentRow(MEMBER.id, made.course.id);
    expect(enrollment!.finalScorePercent).toBe("68.00");
    expect(enrollment!.status).toBe("PASSED");
    expect(enrollment!.completedAt).not.toBeNull();
  });

  it("data B: 100+50, final 60 % < 70 → final_score 69.00, COMPLETED", async () => {
    const made = await finalCourse("ftb", {
      lessonScores: ["100.00", "50.00"],
    });
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptions(made),
      3,
      1,
    );
    await submitQuizAttempt(MEMBER, { attemptId });
    const enrollment = await enrollmentRow(MEMBER.id, made.course.id);
    expect(enrollment!.finalScorePercent).toBe("69.00");
    expect(enrollment!.status).toBe("COMPLETED");
  });

  it("double submit → the same status, enrollments UNTOUCHED (idempotent)", async () => {
    const made = await finalCourse("ftc");
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptions(made),
      4,
      1,
    );
    await submitQuizAttempt(MEMBER, { attemptId });
    const before = await enrollmentRow(MEMBER.id, made.course.id);
    const second = await submitQuizAttempt(MEMBER, { attemptId });
    expect(second.status).toBe("SUBMITTED");
    const after = await enrollmentRow(MEMBER.id, made.course.id);
    expect(after!.finalScorePercent).toBe(before!.finalScorePercent);
    expect(after!.completedAt?.getTime()).toBe(before!.completedAt?.getTime());
    expect(after!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());
  });

  it("recordFinalQuizResult never MOVES a stored completed_at (coalesce, S5-02 mutation 11)", async () => {
    // The idempotent guard keeps the double-submit test away from the
    // enrollment write, so the coalesce is proven HERE: record twice with
    // different submittedAt stamps — the first completed_at wins.
    const made = await finalCourse("ftj");
    const enrollment = (await enrollmentRow(MEMBER.id, made.course.id))!;
    const record = (submittedAt: Date) =>
      db.transaction(async (tx) =>
        recordFinalQuizResult(tx, {
          actorId: MEMBER.id,
          courseId: made.course.id,
          enrollmentId: enrollment.id,
          finalScorePercent: 80,
          isPassed: true,
          weights: { lessonPercent: 60, finalPercent: 40 },
          submittedAt,
        }),
      );
    await record(new Date("2026-01-01T00:00:00.000Z"));
    const first = (await enrollmentRow(MEMBER.id, made.course.id))!
      .completedAt;
    expect(first, "the first submit stamps completed_at").not.toBeNull();
    await record(new Date("2026-02-02T00:00:00.000Z"));
    const second = (await enrollmentRow(MEMBER.id, made.course.id))!
      .completedAt;
    expect(second?.getTime()).toBe(first?.getTime());
  });

  it("the average is scoped to THIS participant: a second member's 0s never leak in", async () => {
    // Owner review before merge: member B finishes the SAME course's two
    // lessons with score 0 — member A (data A: 70+50, Final 80) must still
    // land on 68.00/PASSED. An unscoped lesson_progress join would average
    // (70+0+50+0)/4 = 30 → 50.00.
    const made = await finalCourse("ftk", { lessonScores: ["70.00", "50.00"] });
    await enrollInCourse(MEMBER_B, made.course.id);
    for (const lesson of made.lessons) {
      await completeLessonWithScore(
        MEMBER_B.id,
        made.course.id,
        lesson.id,
        "0.00",
      );
    }
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptions(made),
      4,
      1,
    );
    await submitQuizAttempt(MEMBER, { attemptId });
    const enrollment = await enrollmentRow(MEMBER.id, made.course.id);
    expect(enrollment!.finalScorePercent).toBe("68.00");
    expect(enrollment!.status).toBe("PASSED");
  });

  it("the average is scoped to THIS course: another course's 0 never leaks in", async () => {
    const made = await finalCourse("ftd");
    // A second enrolled course whose single lesson carries score 0 — an
    // unscoped average would read (70+50+0)/3 and change the result.
    const other = await quizCourse("fte");
    await enrollInCourse(MEMBER, other.course.id).catch(() => undefined);
    await completeLessonWithScore(
      MEMBER.id,
      other.course.id,
      other.lessons[0]!.id,
      "0.00",
    );

    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptions(made),
      4,
      1,
    );
    await submitQuizAttempt(MEMBER, { attemptId });
    const enrollment = await enrollmentRow(MEMBER.id, made.course.id);
    expect(enrollment!.finalScorePercent).toBe("68.00");
  });

  it("invalid weights → FINAL submit fails BEFORE the transaction: attempt stays IN_PROGRESS, enrollments untouched", async () => {
    const made = await finalCourse("ftf");
    await seedScoreWeights(50, 40); // sum 90 ≠ 100 → getScoreWeights throws
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await expect(submitQuizAttempt(MEMBER, { attemptId })).rejects.toBeInstanceOf(
      Error,
    );
    expect((await attemptRow(attemptId))!.status).toBe("IN_PROGRESS");
    const enrollment = await enrollmentRow(MEMBER.id, made.course.id);
    expect(enrollment!.finalScorePercent).toBeNull();
    expect(enrollment!.status).toBe("IN_PROGRESS");
    await seedScoreWeights(60, 40); // restore for the tests after this one
  });

  it("invalid weights → a LESSON submit still succeeds (LESSON never reads the weights)", async () => {
    const made = await quizCourse("ftg");
    await seedScoreWeights(50, 40);
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    const result = await submitQuizAttempt(MEMBER, { attemptId });
    expect(result.status).toBe("SUBMITTED");
    const progress = await progressRowOf(MEMBER.id, made.lessons[0]!.id);
    expect(progress!.quizAttempted).toBe(true);
    await seedScoreWeights(60, 40);
  });

  it("hasil-final: the GET after submit reads the STORED final score + course status", async () => {
    const made = await finalCourse("fth");
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptions(made),
      4,
      1,
    );
    await submitQuizAttempt(MEMBER, { attemptId });
    const page = await getFinalQuizPage(MEMBER, made.slug);
    expect(page.state).toBe("hasil-final");
    if (page.state !== "hasil-final") return;
    expect(page.scorePercent).toBe(80);
    expect(page.isPassed).toBe(true);
    expect(page.correct).toBe(4);
    expect(page.wrong).toBe(1);
    expect(page.unanswered).toBe(0);
    expect(page.final.finalScorePercent).toBe(68);
    expect(page.final.courseStatus).toBe("PASSED");
    expect(page.final.lessonAveragePercent).toBe(60);
    expect(page.final.weights).toEqual({ lessonPercent: 60, finalPercent: 40 });
    expect(page.final.durationLimitSeconds).toBe(1200);
    expect(page.items).toHaveLength(5);
  });

  it("hasil-final shows the STORED Nilai Akhir even after the row is edited (never recomputed)", async () => {
    // Owner review before merge: overwrite final_score_percent to 77.00
    // directly in the DB — the GET must show 77, not a recomputed 68
    // (the value the formula would still produce).
    const made = await finalCourse("ftl");
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptions(made),
      4,
      1,
    );
    await submitQuizAttempt(MEMBER, { attemptId });
    expect((await enrollmentRow(MEMBER.id, made.course.id))!.finalScorePercent)
      .toBe("68.00");
    await db
      .update(enrollments)
      .set({ finalScorePercent: "77.00" })
      .where(
        sql`${enrollments.userId} = ${MEMBER.id} and ${enrollments.courseId} = ${made.course.id}`,
      );
    const page = await getFinalQuizPage(MEMBER, made.slug);
    expect(page.state).toBe("hasil-final");
    if (page.state !== "hasil-final") return;
    expect(page.final.finalScorePercent).toBe(77);
    expect(page.scorePercent).toBe(80);
    expect(page.final.lessonAveragePercent).toBe(60);
  });

  it("the lesson-quiz result screen carries finalQuizHref once every lesson is COMPLETED", async () => {
    const made = await finalCourse("fti");
    // A real lesson quiz on lesson 1, attempted and submitted.
    const attached = await attachQuiz(made.lessons[0]!.id, {
      questions: [GRADED_QUESTIONS[0]!],
    });
    const page = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    // No attempt yet: the rules screen exists; finalQuizHref lives on the
    // RESULT DTO — run the real start+submit to see it.
    expect(page.state).toBe("aturan");
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: attached.questionIds[0]!,
      optionId: attached.optionIds[0]![0]!,
    });
    await submitQuizAttempt(MEMBER, { attemptId });
    const hasil = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    expect(hasil.state).toBe("hasil");
    if (hasil.state !== "hasil") return;
    expect(hasil.finalQuizHref).toBe(`/belajar/${made.slug}/final-quiz`);
    // The Final is NOT worked yet (enrollment still IN_PROGRESS).
    expect(hasil.finalQuizDone).toBe(false);
  });

  it("the lesson-quiz result screen keeps finalQuizHref NULL until every lesson is COMPLETED (S5-02 mutation 9)", async () => {
    // complete: false — lesson 2 untouched, so lesson 1's result closing
    // must NOT offer the Final link yet (the gate behind finalQuizHref).
    const made = await finalCourse("fth", { complete: false });
    const attached = await attachQuiz(made.lessons[0]!.id, {
      questions: [GRADED_QUESTIONS[0]!],
    });
    const { attemptId } = await startLessonQuiz(MEMBER, {
      lessonId: made.lessons[0]!.id,
    });
    await saveQuizAnswer(MEMBER, {
      attemptId,
      questionId: attached.questionIds[0]!,
      optionId: attached.optionIds[0]![0]!,
    });
    await submitQuizAttempt(MEMBER, { attemptId });
    const hasil = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    expect(hasil.state).toBe("hasil");
    if (hasil.state !== "hasil") return;
    expect(hasil.finalQuizHref).toBeNull();
  });
});

// --------------------------------------------------------------------------
// finalQuizDone (card S3-02 §5). The stored enrollments.status is the
// source of truth (the "nilai tersimpan" lesson, 19 Nov no. 2) — never a
// recompute from attempts, so the gladi-reset SQL pattern keeps working.
// --------------------------------------------------------------------------

/** Option rows of the final quiz (the FINAL-branch describe's helper,
 *  duplicated here for scope). */
async function finalOptionRows(made: {
  finalQuizId: string;
  correctOptionIds: string[];
}) {
  return db
    .select({
      questionId: questionOptions.questionId,
      id: questionOptions.id,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .innerJoin(questions, eq(questionOptions.questionId, questions.id))
    .where(eq(questions.quizId, made.finalQuizId));
}

/** The finalQuizDone fixture: the FINAL gate open (both lessons COMPLETED
 *  with scores) AND a real submitted lesson quiz on lesson 1 — both
 *  screens that carry finalQuizDone render for it. */
async function completedLessonQuizCourse(prefix: string) {
  const made = await finalCourse(prefix);
  const attached = await attachQuiz(made.lessons[0]!.id, {
    questions: [GRADED_QUESTIONS[0]!],
  });
  const { attemptId } = await startLessonQuiz(MEMBER, {
    lessonId: made.lessons[0]!.id,
  });
  await saveQuizAnswer(MEMBER, {
    attemptId,
    questionId: attached.questionIds[0]!,
    optionId: attached.optionIds[0]![0]!,
  });
  await submitQuizAttempt(MEMBER, { attemptId });
  return made;
}

async function setEnrollmentStatus(
  courseId: string,
  status: "IN_PROGRESS" | "COMPLETED" | "PASSED",
) {
  await db
    .update(enrollments)
    .set({ status })
    .where(
      sql`${enrollments.userId} = ${MEMBER.id} and ${enrollments.courseId} = ${courseId}`,
    );
}

describe("finalQuizDone (card S3-02 §5)", () => {
  it("false before the Final is submitted, true after — on the result DTO AND the open lesson page", async () => {
    const made = await completedLessonQuizCourse("fd1");
    const before = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    if (before.state !== "hasil") throw new Error("expected hasil");
    expect(before.finalQuizHref).not.toBeNull();
    expect(before.finalQuizDone).toBe(false); // enrollment still IN_PROGRESS

    // 3 of 5 correct = 60 % < 70 → courseStatus COMPLETED, not PASSED: a
    // FAILED Final was still WORKED — done must flip either way.
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptionRows(made),
      3,
      1,
    );
    await submitQuizAttempt(MEMBER, { attemptId });
    expect((await enrollmentRow(MEMBER.id, made.course.id))!.status).toBe(
      "COMPLETED",
    );

    const after = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    if (after.state !== "hasil") throw new Error("expected hasil");
    expect(after.finalQuizDone).toBe(true);

    const open = await getLessonPage(MEMBER, made.slug, made.lessons[0]!.slug);
    if (open.state !== "open") throw new Error("expected open");
    expect(open.finalQuizHref).not.toBeNull();
    expect(open.finalQuizDone).toBe(true);
  });

  it("status set to COMPLETED directly in the DB, WITHOUT a Final attempt → true (the STORED value wins)", async () => {
    const made = await completedLessonQuizCourse("fd2");
    await setEnrollmentStatus(made.course.id, "COMPLETED");
    const hasil = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    if (hasil.state !== "hasil") throw new Error("expected hasil");
    expect(hasil.finalQuizDone).toBe(true);
  });

  it("Final submitted, then status reset to IN_PROGRESS (the gladi-reset SQL pattern) → false", async () => {
    const made = await completedLessonQuizCourse("fd3");
    const { attemptId } = await startFinalQuiz(MEMBER, {
      courseId: made.course.id,
    });
    await answerFinalAttempt(
      attemptId,
      made.correctOptionIds,
      await finalOptionRows(made),
      4,
      1,
    );
    await submitQuizAttempt(MEMBER, { attemptId }); // PASSED — attempt FINALIZED
    // The gladi reset flips the STORED status back so the Final re-opens;
    // a recompute from the (still-finalized) attempt would fight it.
    await setEnrollmentStatus(made.course.id, "IN_PROGRESS");
    const hasil = await getLessonQuizPage(
      MEMBER,
      made.slug,
      made.lessons[0]!.slug,
    );
    if (hasil.state !== "hasil") throw new Error("expected hasil");
    expect(hasil.finalQuizDone).toBe(false);
    const open = await getLessonPage(MEMBER, made.slug, made.lessons[0]!.slug);
    if (open.state !== "open") throw new Error("expected open");
    expect(open.finalQuizDone).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Nilai Saya (card S5-03). Every test inserts its OWN fresh member
// (u-grades-N, owner review addition) — MEMBER/MEMBER_B carry data from
// the 80+ tests above, and the empty/running cases only mean anything for
// a participant with no history.
// --------------------------------------------------------------------------

/** A fresh MEMBER row (owner review addition: never the shared fixtures). */
async function gradesMember(id: string, name: string) {
  await db.insert(users).values({
    id,
    name,
    email: `${id}@example.com`,
    emailVerified: true,
    role: "MEMBER",
  });
  return { id, role: "MEMBER" as const, status: "ACTIVE" as const };
}

/**
 * The grades fixture: PUBLISHED course whose EVERY lesson carries a quiz
 * (attachQuiz — grades rows need lessons.quiz_id for their review hrefs),
 * plus the FINAL quiz with `finalQuestionCount` questions, actor enrolled.
 */
async function gradesCourse(
  actor: { id: string; role: "MEMBER"; status: "ACTIVE" },
  prefix: string,
  options: {
    lessonTitles?: string[];
    isSequential?: boolean;
    finalQuestionCount?: number;
    explanationPolicies?: ("ALWAYS" | "ON_PASS_ONLY" | "NEVER")[];
    enroll?: boolean;
  } = {},
) {
  await seedScoreWeights(60, 40);
  const { title, slug } = nextPair(prefix);
  const course = await createCourse(EDITOR, {
    title,
    slug,
    level: "BEGINNER",
    summary: "Ringkasan netral untuk tes.",
  });
  const lessonRows = [];
  for (const lessonTitle of options.lessonTitles ?? [
    "Materi alpha",
    "Materi beta",
  ]) {
    lessonRows.push(
      await createLesson(EDITOR, course.id, { title: lessonTitle }),
    );
  }
  for (const [index, lesson] of lessonRows.entries()) {
    await attachQuiz(lesson.id, {
      explanationPolicy: options.explanationPolicies?.[index] ?? "ALWAYS",
    });
  }
  const [courseRow] = await db
    .select({ finalQuizId: courses.finalQuizId })
    .from(courses)
    .where(eq(courses.id, course.id));
  if (!courseRow?.finalQuizId) throw new Error("course without FINAL quiz");
  await db
    .update(quizzes)
    .set({
      title: `Final Quiz ${title}`,
      durationMinutes: 20,
      passingScorePercent: 70,
      shuffleQuestions: false,
      shuffleOptions: false,
      explanationPolicy: "ALWAYS",
    })
    .where(eq(quizzes.id, courseRow.finalQuizId));
  const filled = await fillFinalQuiz(
    courseRow.finalQuizId,
    finalQuestions(options.finalQuestionCount ?? 5),
  );
  if (options.isSequential === true) {
    await db
      .update(courses)
      .set({ isSequential: true })
      .where(eq(courses.id, course.id));
  } else {
    // The column defaults to TRUE — opt out explicitly so the non-sequential
    // variants really are non-sequential.
    await db
      .update(courses)
      .set({ isSequential: false })
      .where(eq(courses.id, course.id));
  }
  await db
    .update(courses)
    .set({ status: "PUBLISHED" })
    .where(eq(courses.id, course.id));
  if (options.enroll ?? true) {
    await enrollInCourse(actor, course.id);
  }
  return {
    course,
    title,
    slug,
    lessons: lessonRows,
    finalQuizId: courseRow.finalQuizId,
    ...filled,
  };
}

/** Work the Final as `actor`: start, answer, submit → the attemptId. */
async function workFinalAs(
  actor: { id: string; role: "MEMBER"; status: "ACTIVE" },
  made: { course: { id: string }; finalQuizId: string; correctOptionIds: string[] },
  correctCount: number,
  wrongCount: number,
) {
  const { attemptId } = await startFinalQuiz(actor, {
    courseId: made.course.id,
  });
  const optionRows = await db
    .select({
      questionId: questionOptions.questionId,
      id: questionOptions.id,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .innerJoin(questions, eq(questionOptions.questionId, questions.id))
    .where(eq(questions.quizId, made.finalQuizId));
  await answerFinalAttempt(
    attemptId,
    made.correctOptionIds,
    optionRows,
    correctCount,
    wrongCount,
    actor,
  );
  await submitQuizAttempt(actor, { attemptId });
  return attemptId;
}

describe("getGradesPage", () => {
  it("kosong: not enrolled → courses [] and enrolled-without-grades → []; weights follow system_settings (70/30)", async () => {
    const actor = await gradesMember("u-grades-1", "Grades Satu");
    const made = await gradesCourse(actor, "gka", { enroll: false });
    await seedScoreWeights(70, 30);
    try {
      let page = await getGradesPage(actor);
      expect(page.courses).toEqual([]);
      expect(page.weights).toEqual({ lessonPercent: 70, finalPercent: 30 });
      await enrollInCourse(actor, made.course.id);
      page = await getGradesPage(actor);
      expect(page.courses).toEqual([]);
    } finally {
      await seedScoreWeights(60, 40); // restore for the tests after this one
    }
  });

  it("kursus Lulus: stored numbers, hrefs, meta selesai, nextStep null — SAME numbers as getFinalQuizPage hasil-final", async () => {
    const actor = await gradesMember("u-grades-2", "Grades Dua");
    const made = await gradesCourse(actor, "gkb");
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[0]!.id,
      "70.00",
    );
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[1]!.id,
      "50.00",
    );
    await workFinalAs(actor, made, 4, 1); // 80.00 ≥ 70 → PASSED, stored 68.00

    const page = await getGradesPage(actor);
    expect(page.courses).toHaveLength(1);
    const dto = page.courses[0]!;
    expect(dto.title).toBe(made.title);
    expect(dto.lessonCount).toBe(2);
    expect(dto.badge).toBe("lulus");
    expect(dto.finalScorePercent).toBe(68);
    expect(dto.lessonAveragePercent).toBe(60);
    expect(dto.lessons.map((row) => row.result!.scorePercent)).toEqual([70, 50]);
    expect(dto.final!.result!.scorePercent).toBe(80);
    expect(dto.final!.result!.isPassed).toBe(true);
    expect(dto.final!.questionCount).toBe(5);
    expect(dto.meta.kind).toBe("selesai");
    expect(dto.nextStep).toBeNull();
    expect(dto.lockedCount).toBe(0);
    expect(dto.lessons[0]!.result!.reviewHref).toBe(
      `/belajar/${made.slug}/${made.lessons[0]!.slug}/quiz`,
    );
    expect(dto.final!.reviewHref).toBe(`/belajar/${made.slug}/final-quiz`);
    const enrollment = (await enrollmentRow(actor.id, made.course.id))!;
    expect(dto.meta.at).toBe(enrollment.completedAt!.toISOString());

    // One data set, two screens, one set of numbers (card "Selesai jika").
    const finalPage = await getFinalQuizPage(actor, made.slug);
    if (finalPage.state !== "hasil-final") {
      throw new Error("expected hasil-final");
    }
    expect(finalPage.final.lessonAveragePercent).toBe(
      dto.lessonAveragePercent,
    );
    expect(finalPage.scorePercent).toBe(dto.final!.result!.scorePercent);
    expect(finalPage.final.finalScorePercent).toBe(dto.finalScorePercent);
  });

  it("kursus berjalan sekuensial 3 materi: [1 ber-result, 2 belum], lockedCount 1, final.result null, nextStep materi", async () => {
    const actor = await gradesMember("u-grades-3", "Grades Tiga");
    const made = await gradesCourse(actor, "gkc", {
      lessonTitles: ["Materi satu", "Materi dua", "Materi tiga"],
      isSequential: true,
    });
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[0]!.id,
      "70.00",
    );
    const dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.badge).toBe("sedang-berjalan");
    expect(dto.lessons).toHaveLength(2);
    expect(dto.lessons[0]!.result!.scorePercent).toBe(70);
    expect(dto.lessons[1]!.result).toBeNull();
    expect(dto.lockedCount).toBe(1);
    expect(dto.final!.result).toBeNull();
    expect(dto.nextStep).toBe("materi");
    expect(dto.meta.kind).toBe("terakhir-diakses");
    expect(dto.finalScorePercent).toBeNull();
  });

  it("varian tidak berurutan → semua baris tampil, lockedCount 0; semua COMPLETED tanpa Final dikerjakan → nextStep final", async () => {
    const actor = await gradesMember("u-grades-4", "Grades Empat");
    const made = await gradesCourse(actor, "gkd", {
      lessonTitles: ["Materi satu", "Materi dua", "Materi tiga"],
    });
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[0]!.id,
      "70.00",
    );
    let dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.lessons).toHaveLength(3);
    expect(dto.lockedCount).toBe(0);

    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[1]!.id,
      "50.00",
    );
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[2]!.id,
      "60.00",
    );
    dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.nextStep).toBe("final");
    expect(dto.final!.result).toBeNull();
    expect(dto.lessonAveragePercent).toBe(60);
  });

  it("peserta lain: progres + Final di kursus yang sama dan pendaftaran di kursus lain → DTO aktor TIDAK berubah", async () => {
    const actor = await gradesMember("u-grades-5", "Grades Lima");
    const other = await gradesMember("u-grades-6", "Grades Enam");
    const made = await gradesCourse(actor, "gke");
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[0]!.id,
      "70.00",
    );
    // Snapshot BEFORE any of the other participant's data exists.
    const before = await getGradesPage(actor);

    // (a) Same course: the other participant works the lesson the actor has
    // NOT worked, then the Final (deterministic: a SUBMITTED Final attempt
    // by someone else must not leak into the actor's final.result).
    await enrollInCourse(other, made.course.id);
    await completeLessonWithScore(
      other.id,
      made.course.id,
      made.lessons[0]!.id,
      "100.00",
      { quizIsPassed: true },
    );
    await completeLessonWithScore(
      other.id,
      made.course.id,
      made.lessons[1]!.id,
      "100.00",
      { quizIsPassed: true },
    );
    await workFinalAs(other, made, 1, 4); // 20.00
    // (b) A course the actor does not follow at all.
    const otherCourse = await gradesCourse(other, "gkf");
    for (const lesson of otherCourse.lessons) {
      await completeLessonWithScore(
        other.id,
        otherCourse.course.id,
        lesson.id,
        "100.00",
        { quizIsPassed: true },
      );
    }
    await workFinalAs(other, otherCourse, 5, 0); // 100.00

    const after = await getGradesPage(actor);
    expect(after).toEqual(before);
  });

  it("dua kursus dengan Final berbeda jumlah soal → questionCount masing-masing benar", async () => {
    const actor = await gradesMember("u-grades-7", "Grades Tujuh");
    const five = await gradesCourse(actor, "gkg", { finalQuestionCount: 5 });
    const ten = await gradesCourse(actor, "gkh", { finalQuestionCount: 10 });
    await completeLessonWithScore(
      actor.id,
      five.course.id,
      five.lessons[0]!.id,
      "70.00",
    );
    await completeLessonWithScore(
      actor.id,
      ten.course.id,
      ten.lessons[0]!.id,
      "80.00",
    );
    const page = await getGradesPage(actor);
    const byTitle = new Map(page.courses.map((row) => [row.title, row]));
    expect(byTitle.get(five.title)!.final!.questionCount).toBe(5);
    expect(byTitle.get(ten.title)!.final!.questionCount).toBe(10);
  });

  it("nilai tersimpan: 91.40 → 91, 67.50 → 68, 69.99 → 69, isPassed dari kolom, badge dari enrollments.status", async () => {
    const actor = await gradesMember("u-grades-8", "Grades Delapan");
    const made = await gradesCourse(actor, "gki");
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[0]!.id,
      "69.99",
      { quizIsPassed: true },
    );
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[1]!.id,
      "80.00",
      { quizIsPassed: false },
    );
    await workFinalAs(actor, made, 4, 1); // attempt is_passed = true
    const enrollmentId = (await enrollmentRow(actor.id, made.course.id))!.id;

    let dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.lessons[0]!.result!.scorePercent).toBe(69);
    expect(dto.lessons[1]!.result!.scorePercent).toBe(80);
    expect(dto.lessons[1]!.result!.isPassed).toBe(false); // stored column wins
    expect(dto.finalScorePercent).toBe(77); // round(0.6 × 74.995 + 0.4 × 80)

    await db
      .update(enrollments)
      .set({ finalScorePercent: "91.40" })
      .where(eq(enrollments.id, enrollmentId));
    dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.finalScorePercent).toBe(91);

    await db
      .update(enrollments)
      .set({ finalScorePercent: "67.50" })
      .where(eq(enrollments.id, enrollmentId));
    dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.finalScorePercent).toBe(68);

    // The attempt passed, but the STORED status is the badge's source.
    await db
      .update(enrollments)
      .set({ status: "COMPLETED" })
      .where(eq(enrollments.id, enrollmentId));
    dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.badge).toBe("selesai");
    expect(dto.final!.result!.isPassed).toBe(true);
  });

  it("attempt Final: reset tanpa attempt baru → null; reset + IN_PROGRESS → null; reset(10) + hidup(80) → 80", async () => {
    const actor = await gradesMember("u-grades-9", "Grades Sembilan");
    const made = await gradesCourse(actor, "gkj");
    for (const lesson of made.lessons) {
      await completeLessonWithScore(
        actor.id,
        made.course.id,
        lesson.id,
        "70.00",
      );
    }
    const first = await workFinalAs(actor, made, 4, 1); // 80.00

    // Reset with no new attempt: no live finished attempt → null.
    await db
      .update(quizAttempts)
      .set({ resetAt: new Date() })
      .where(eq(quizAttempts.id, first));
    let dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.final!.result).toBeNull();

    // A new IN_PROGRESS attempt is not a grade either.
    const firstRow = (await attemptRow(first))!;
    await db.insert(quizAttempts).values({
      quizId: firstRow.quizId,
      userId: actor.id,
      enrollmentId: firstRow.enrollmentId,
      attemptNumber: firstRow.attemptNumber + 1,
      status: "IN_PROGRESS",
      questionOrder: firstRow.questionOrder,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 20 * 60_000),
    });
    dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.final!.result).toBeNull();

    // Finish the live attempt (80) while the reset one reads 10: the LIVE
    // one wins — higher attempt_number among reset_at IS NULL rows.
    const [live] = await db
      .select({ id: quizAttempts.id })
      .from(quizAttempts)
      .where(
        sql`${quizAttempts.quizId} = ${firstRow.quizId} and ${quizAttempts.userId} = ${actor.id} and ${quizAttempts.resetAt} is null`,
      );
    const optionRows = await db
      .select({
        questionId: questionOptions.questionId,
        id: questionOptions.id,
        isCorrect: questionOptions.isCorrect,
      })
      .from(questionOptions)
      .innerJoin(questions, eq(questionOptions.questionId, questions.id))
      .where(eq(questions.quizId, made.finalQuizId));
    await answerFinalAttempt(
      live!.id,
      made.correctOptionIds,
      optionRows,
      4,
      1,
      actor,
    );
    await submitQuizAttempt(actor, { attemptId: live!.id });
    await db
      .update(quizAttempts)
      .set({ scorePercent: "10.00" })
      .where(eq(quizAttempts.id, first));
    dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.final!.result!.scorePercent).toBe(80);
  });

  it("visibilitas + urutan: DRAFT/ARCHIVED tidak muncul; urutan mengikuti enrolled_at, bukan urutan pembuatan", async () => {
    const actor = await gradesMember("u-grades-10", "Grades Sepuluh");
    const first = await gradesCourse(actor, "gkk");
    const second = await gradesCourse(actor, "gkl");
    const draft = await gradesCourse(actor, "gkm");
    const archived = await gradesCourse(actor, "gkn");
    for (const made of [first, second, draft, archived]) {
      await completeLessonWithScore(
        actor.id,
        made.course.id,
        made.lessons[0]!.id,
        "70.00",
      );
    }
    // enrolled_at EXPLICITLY reversed from the creation order.
    await db
      .update(enrollments)
      .set({ enrolledAt: new Date("2026-11-02T00:00:00Z") })
      .where(
        sql`${enrollments.userId} = ${actor.id} and ${enrollments.courseId} = ${first.course.id}`,
      );
    await db
      .update(enrollments)
      .set({ enrolledAt: new Date("2026-11-01T00:00:00Z") })
      .where(
        sql`${enrollments.userId} = ${actor.id} and ${enrollments.courseId} = ${second.course.id}`,
      );
    await db
      .update(courses)
      .set({ status: "DRAFT" })
      .where(eq(courses.id, draft.course.id));
    await db
      .update(courses)
      .set({ status: "ARCHIVED" })
      .where(eq(courses.id, archived.course.id));

    const page = await getGradesPage(actor);
    expect(page.courses.map((row) => row.title)).toEqual([
      second.title,
      first.title,
    ]);
  });

  it("reviewAccess: NEVER → HIDDEN_NEVER; ON_PASS_ONLY gagal → HIDDEN_NOT_PASSED; lulus → PASSED; Final ALWAYS → ALWAYS", async () => {
    const actor = await gradesMember("u-grades-11", "Grades Sebelas");
    const made = await gradesCourse(actor, "gko", {
      explanationPolicies: ["NEVER", "ON_PASS_ONLY"],
    });
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[0]!.id,
      "80.00",
      { quizIsPassed: true },
    );
    await completeLessonWithScore(
      actor.id,
      made.course.id,
      made.lessons[1]!.id,
      "40.00",
      { quizIsPassed: false },
    );
    let dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.lessons[0]!.result!.reviewAccess).toBe("HIDDEN_NEVER");
    expect(dto.lessons[1]!.result!.reviewAccess).toBe("HIDDEN_NOT_PASSED");

    await db
      .update(lessonProgress)
      .set({ quizIsPassed: true })
      .where(
        sql`${lessonProgress.userId} = ${actor.id} and ${lessonProgress.lessonId} = ${made.lessons[1]!.id}`,
      );
    dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.lessons[1]!.result!.reviewAccess).toBe("PASSED");

    await workFinalAs(actor, made, 4, 1);
    dto = (await getGradesPage(actor)).courses[0]!;
    expect(dto.final!.result!.reviewAccess).toBe("ALWAYS");
  });

  it("bobot tidak sah → getGradesPage melempar (gagal tertutup)", async () => {
    const actor = await gradesMember("u-grades-12", "Grades Dua Belas");
    await gradesCourse(actor, "gkp");
    await seedScoreWeights(50, 40); // sum 90 ≠ 100 → getScoreWeights throws
    try {
      await expect(getGradesPage(actor)).rejects.toBeInstanceOf(Error);
    } finally {
      await seedScoreWeights(60, 40); // restore for the tests after this one
    }
  });
});
