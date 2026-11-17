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
import { eq, sql } from "drizzle-orm";
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
  getLessonQuizPage,
  saveQuizAnswer,
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
    expect(dto.scorePercent).toBe(29); // 2/7 = 28.57 → 29
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

  it("unknown course slug, unknown lesson slug, not enrolled, and a quiz-less lesson all answer 404", async () => {
    await expect(
      getLessonQuizPage(MEMBER, "kursus-tak-ada", "apapun"),
    ).rejects.toThrow(NotFoundError);

    const made = await quizCourse("qp9");
    await expect(
      getLessonQuizPage(MEMBER, made.slug, "materi-tak-ada"),
    ).rejects.toThrow(NotFoundError);

    const lone = await quizCourse("qp10");
    await expect(
      getLessonQuizPage(MEMBER_B, lone.slug, lone.lessons[0]!.slug),
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
