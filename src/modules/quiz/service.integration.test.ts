// Integration tests for quiz-module settings over PGlite (card S1-02):
// getMinQuestions is fail-closed — a missing quiz.min_questions row, a
// string "10", or 0 must all reject with an Error naming the key and the
// seed command (never a silent fallback number). Card S1-09 adds the
// score-weight reader, the question save transactions, and the editor
// lookup.
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  auditLogs,
  courses,
  questionOptions,
  questions,
  systemSettings,
  users,
} from "@/db/schema";
import { validateContentDoc } from "@/lib/content-doc-validator";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { createCourse } from "@/modules/course/service";
import { createLesson } from "@/modules/lesson/service";

// Same harness pattern as src/modules/course/service.integration.test.ts:
// "server-only" stubbed, the "@/db" singleton proxied onto the PGlite
// instance installed in beforeAll.
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
          throw new Error("@/db mock used before the PGlite instance was installed");
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
  createQuestion,
  findQuestionRuleViolations,
  formatQuizRuleViolation,
  getMinQuestions,
  getQuizEditor,
  getScoreWeights,
  updateQuestion,
} from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

const EDITOR = { id: "u-editor-quiz", role: "EDITOR" as const };
const MEMBER = { id: "u-member-quiz", role: "MEMBER" as const };

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("../../db/migrations", import.meta.url)),
  });
  db = pgliteDb as unknown as Db;
  dbHolder.current = pgliteDb;

  await db.insert(users).values([
    {
      id: EDITOR.id,
      name: "Editor Quiz",
      email: "editor-quiz@example.com",
      emailVerified: true,
      role: "EDITOR",
    },
    {
      id: MEMBER.id,
      name: "Member Quiz",
      email: "member-quiz@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
  ]);
});

afterAll(async () => {
  await pglite.close();
});

/**
 * Writes the setting as EXACTLY the JSON value intended: a JS string like
 * "10" passed as a plain drizzle jsonb param arrives as the text '10' and
 * Postgres casts it to the JSON NUMBER 10 — the very invalid shape the
 * test wants to plant would silently turn valid. Stringify + ::jsonb pins
 * the JSONB type.
 */
async function setSetting(value: unknown): Promise<void> {
  await pglite.query(
    `insert into system_settings (key, value)
     values ('quiz.min_questions', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(value)],
  );
}

describe("getMinQuestions — fail-closed", () => {
  it("a valid integer ≥ 1 resolves", async () => {
    await setSetting(10);
    await expect(getMinQuestions()).resolves.toBe(10);
    await setSetting(1);
    await expect(getMinQuestions()).resolves.toBe(1);
  });

  it("missing row → Error naming the key and npm run db:seed", async () => {
    await db
      .delete(systemSettings)
      .where(eq(systemSettings.key, "quiz.min_questions"));
    const error = await getMinQuestions().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("quiz.min_questions");
    expect(message).toContain("npm run db:seed");
  });

  it("string \"10\" → Error", async () => {
    await setSetting("10");
    await expect(getMinQuestions()).rejects.toBeInstanceOf(Error);
  });

  it("0 → Error", async () => {
    await setSetting(0);
    await expect(getMinQuestions()).rejects.toBeInstanceOf(Error);
  });

  it("non-integer numbers → Error", async () => {
    await setSetting(9.5);
    await expect(getMinQuestions()).rejects.toBeInstanceOf(Error);
  });
});

// ------------------------------------------------- S1-09 question flows

/** setSetting for ANY key (the original above pins quiz.min_questions). */
async function setSettingKey(key: string, value: unknown): Promise<void> {
  await pglite.query(
    `insert into system_settings (key, value)
     values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}

/** Resets the three settings the editor page reads (seed values). */
async function seedEditorSettings(): Promise<void> {
  await setSettingKey("quiz.min_questions", 10);
  await setSettingKey("score.lesson_weight", 60);
  await setSettingKey("score.final_weight", 40);
}

/** Fresh DRAFT course; answers its FINAL quiz id. */
async function newDraftCourseWithFinalQuiz(): Promise<{
  courseId: string;
  finalQuizId: string;
}> {
  const tag = randomUUID().slice(0, 8);
  const dto = await createCourse(EDITOR, {
    title: `Qz kursus ${tag}`,
    slug: `qz-kursus-${tag}`,
    level: "BEGINNER",
    summary: "Ringkasan netral untuk tes.",
  });
  const [row] = await db
    .select({ finalQuizId: courses.finalQuizId })
    .from(courses)
    .where(eq(courses.id, dto.id));
  if (!row?.finalQuizId) throw new Error("course created without FINAL quiz");
  return { courseId: dto.id, finalQuizId: row.finalQuizId };
}

/** A valid PG question input; spread and bent per test. */
const PG_INPUT = {
  type: "SINGLE_CHOICE",
  text: "Pertanyaan soal pg",
  explanation: "Pembahasan soal pg",
  options: [
    { text: "Opsi satu", isCorrect: true },
    { text: "Opsi dua", isCorrect: false },
    { text: "Opsi tiga", isCorrect: false },
    { text: "Opsi empat", isCorrect: false },
  ],
} as const;

const BS_INPUT = {
  type: "TRUE_FALSE",
  text: "Pertanyaan soal bs",
  explanation: "Pembahasan soal bs",
  options: [
    { text: "Benar", isCorrect: true },
    { text: "Salah", isCorrect: false },
  ],
} as const;

describe("getScoreWeights — fail-closed (card S1-09)", () => {
  it("seed values 60/40 resolve", async () => {
    await setSettingKey("score.lesson_weight", 60);
    await setSettingKey("score.final_weight", 40);
    await expect(getScoreWeights()).resolves.toEqual({
      lessonPercent: 60,
      finalPercent: 40,
    });
  });

  it("missing row → Error naming BOTH keys and npm run db:seed", async () => {
    await setSettingKey("score.lesson_weight", 60);
    await db
      .delete(systemSettings)
      .where(eq(systemSettings.key, "score.final_weight"));
    const error = await getScoreWeights().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("score.lesson_weight");
    expect(message).toContain("score.final_weight");
    expect(message).toContain("npm run db:seed");
  });

  // The both-missing case pins the reader's fail-closed shape: a fallback
  // that only kicks in when EVERY row is gone (the surviving && variant of
  // mutation 13) must redden here too, not just in the one-row test.
  it("BOTH rows missing → Error naming BOTH keys and npm run db:seed", async () => {
    await pglite.query(
      "delete from system_settings where key in ('score.lesson_weight', 'score.final_weight')",
    );
    const error = await getScoreWeights().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("score.lesson_weight");
    expect(message).toContain("score.final_weight");
    expect(message).toContain("npm run db:seed");
  });

  it("string \"40\" → Error", async () => {
    await setSettingKey("score.lesson_weight", 60);
    await setSettingKey("score.final_weight", "40");
    await expect(getScoreWeights()).rejects.toBeInstanceOf(Error);
  });

  it("150 → Error", async () => {
    await setSettingKey("score.lesson_weight", 150);
    await setSettingKey("score.final_weight", -50);
    await expect(getScoreWeights()).rejects.toBeInstanceOf(Error);
  });

  it("sum ≠ 100 → Error", async () => {
    await setSettingKey("score.lesson_weight", 60);
    await setSettingKey("score.final_weight", 39);
    await expect(getScoreWeights()).rejects.toBeInstanceOf(Error);
  });
});

describe("createQuestion — one transaction (card S1-09 §2)", () => {
  beforeEach(async () => {
    await seedEditorSettings();
  });

  it("writes question + 4 options + one summary-only audit row + touches the course", async () => {
    const { courseId, finalQuizId } = await newDraftCourseWithFinalQuiz();
    await db
      .update(courses)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(courses.id, courseId));

    const dto = await createQuestion(EDITOR, { quizId: finalQuizId }, PG_INPUT);
    expect(dto.orderIndex).toBe(1);
    expect(dto.type).toBe("SINGLE_CHOICE");

    const [row] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, dto.id));
    if (!row) throw new Error("question row missing");
    expect(row.quizId).toBe(finalQuizId);
    expect(row.points).toBe(1);
    // The stored documents pass the shared validator (roundtrip-safe).
    expect(validateContentDoc(row.text).ok).toBe(true);
    expect(validateContentDoc(row.explanation).ok).toBe(true);

    const options = await db
      .select()
      .from(questionOptions)
      .where(eq(questionOptions.questionId, dto.id));
    expect(options).toHaveLength(4);
    expect(options.map((option) => option.orderIndex)).toEqual([1, 2, 3, 4]);
    expect(options.filter((option) => option.isCorrect)).toHaveLength(1);

    const [courseRow] = await db
      .select({ updatedBy: courses.updatedBy, updatedAt: courses.updatedAt })
      .from(courses)
      .where(eq(courses.id, courseId));
    expect(courseRow?.updatedBy).toBe(EDITOR.id);
    expect((courseRow?.updatedAt ?? new Date(0)).getTime()).toBeGreaterThan(
      new Date("2020-01-01T00:00:00Z").getTime(),
    );

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, dto.id));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe("question.create");
    expect(audits[0]?.before).toBeNull();
    expect(audits[0]?.after).toEqual({
      quizId: finalQuizId,
      type: "SINGLE_CHOICE",
      orderIndex: 1,
      optionCount: 4,
    });
  });

  it("a LESSON quiz works the same; orderIndex runs 1, 2, 3 across quizzes", async () => {
    const { courseId } = await newDraftCourseWithFinalQuiz();
    const lesson = await createLesson(EDITOR, courseId, {
      title: "Materi quiz les",
    });

    const first = await createQuestion(EDITOR, { quizId: lesson.quizId }, PG_INPUT);
    const second = await createQuestion(EDITOR, { quizId: lesson.quizId }, BS_INPUT);
    const third = await createQuestion(EDITOR, { quizId: lesson.quizId }, PG_INPUT);
    expect([first.orderIndex, second.orderIndex, third.orderIndex]).toEqual([
      1, 2, 3,
    ]);

    // B/S stores exactly the two fixed options.
    const bsOptions = await db
      .select()
      .from(questionOptions)
      .where(eq(questionOptions.questionId, second.id));
    expect(bsOptions.map((option) => option.text)).toEqual(["Benar", "Salah"]);
  });

  it("IN_REVIEW → 409 and NOTHING is written", async () => {
    const { courseId, finalQuizId } = await newDraftCourseWithFinalQuiz();
    await db
      .update(courses)
      .set({ status: "IN_REVIEW" })
      .where(eq(courses.id, courseId));
    const before = await db.$count(questions);

    await expect(
      createQuestion(EDITOR, { quizId: finalQuizId }, PG_INPUT),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await db.$count(questions)).toBe(before);
  });

  it("unknown quiz → 404", async () => {
    await expect(
      createQuestion(EDITOR, { quizId: randomUUID() }, PG_INPUT),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("MEMBER → 403 BEFORE the input is parsed", async () => {
    // Garbage input proves parsing never ran: a ZodError would mean it did.
    await expect(
      createQuestion(MEMBER, { quizId: randomUUID() }, { bukan: "kontrak" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("server rules reject with exact paths and leave the DB untouched", async () => {
    const { finalQuizId } = await newDraftCourseWithFinalQuiz();
    const before = await db.$count(questions);

    const cases: unknown[] = [
      { ...PG_INPUT, options: PG_INPUT.options.slice(0, 3) },
      {
        ...PG_INPUT,
        options: PG_INPUT.options.map((option) => ({
          ...option,
          isCorrect: true,
        })),
      },
      {
        ...BS_INPUT,
        options: [
          { text: "Ya", isCorrect: true },
          { text: "Tidak", isCorrect: false },
        ],
      },
      { ...PG_INPUT, explanation: " " },
    ];
    const expectedPaths = ["options", "options", "options", "explanation"];

    for (const [index, input] of cases.entries()) {
      const error = await createQuestion(
        EDITOR,
        { quizId: finalQuizId },
        input,
      ).catch((e: unknown) => e);
      expect(error, `case ${index}`).toBeInstanceOf(ZodError);
      if (error instanceof ZodError) {
        expect(
          error.issues.some(
            (issue) => issue.path.join(".") === expectedPaths[index],
          ),
          `case ${index} path ${expectedPaths[index]}`,
        ).toBe(true);
      }
    }
    expect(await db.$count(questions)).toBe(before);
  });
});

describe("updateQuestion — one transaction (card S1-09 §2)", () => {
  beforeEach(async () => {
    await seedEditorSettings();
  });

  it("replaces the options when PG becomes B/S (4 → 2), keeps orderIndex, audits before/after", async () => {
    const { courseId, finalQuizId } = await newDraftCourseWithFinalQuiz();
    const created = await createQuestion(EDITOR, { quizId: finalQuizId }, PG_INPUT);
    await createQuestion(EDITOR, { quizId: finalQuizId }, PG_INPUT);

    const dto = await updateQuestion(
      EDITOR,
      { quizId: finalQuizId, questionId: created.id },
      BS_INPUT,
    );
    expect(dto.orderIndex).toBe(1);
    expect(dto.type).toBe("TRUE_FALSE");

    const options = await db
      .select()
      .from(questionOptions)
      .where(eq(questionOptions.questionId, created.id));
    expect(options).toHaveLength(2);
    expect(options.map((option) => option.text)).toEqual(["Benar", "Salah"]);

    const [row] = await db
      .select({ text: questions.text })
      .from(questions)
      .where(eq(questions.id, created.id));
    expect(validateContentDoc(row?.text).ok).toBe(true);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, "question.update")));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.before).toEqual({
      quizId: finalQuizId,
      type: "SINGLE_CHOICE",
      orderIndex: 1,
      optionCount: 4,
    });
    expect(audits[0]?.after).toEqual({
      quizId: finalQuizId,
      type: "TRUE_FALSE",
      orderIndex: 1,
      optionCount: 2,
    });

    const [courseRow] = await db
      .select({ updatedBy: courses.updatedBy })
      .from(courses)
      .where(eq(courses.id, courseId));
    expect(courseRow?.updatedBy).toBe(EDITOR.id);
  });

  it("a question of ANOTHER quiz under this quiz's id → 404 (anti-IDOR)", async () => {
    const a = await newDraftCourseWithFinalQuiz();
    const b = await newDraftCourseWithFinalQuiz();
    const inB = await createQuestion(EDITOR, { quizId: b.finalQuizId }, PG_INPUT);

    await expect(
      updateQuestion(
        EDITOR,
        { quizId: a.finalQuizId, questionId: inB.id },
        PG_INPUT,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("unknown question → 404; IN_REVIEW → 409; MEMBER → 403 before parse", async () => {
    const { courseId, finalQuizId } = await newDraftCourseWithFinalQuiz();
    const created = await createQuestion(EDITOR, { quizId: finalQuizId }, PG_INPUT);

    await expect(
      updateQuestion(
        EDITOR,
        { quizId: finalQuizId, questionId: randomUUID() },
        PG_INPUT,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    await db
      .update(courses)
      .set({ status: "PUBLISHED" })
      .where(eq(courses.id, courseId));
    await expect(
      updateQuestion(
        EDITOR,
        { quizId: finalQuizId, questionId: created.id },
        PG_INPUT,
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      updateQuestion(
        MEMBER,
        { quizId: finalQuizId, questionId: created.id },
        { bukan: "kontrak" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("getQuizEditor (card S1-09 §3)", () => {
  beforeEach(async () => {
    await seedEditorSettings();
  });

  it("FINAL path: owner.lesson null, questions + grouped options ordered, settings ride along", async () => {
    const { courseId, finalQuizId } = await newDraftCourseWithFinalQuiz();
    const first = await createQuestion(EDITOR, { quizId: finalQuizId }, PG_INPUT);
    const second = await createQuestion(EDITOR, { quizId: finalQuizId }, BS_INPUT);

    const editor = await getQuizEditor(EDITOR, { quizId: finalQuizId });
    expect(editor.quiz.id).toBe(finalQuizId);
    expect(editor.quiz.type).toBe("FINAL");
    expect(editor.owner.courseId).toBe(courseId);
    expect(editor.owner.lesson).toBeNull();
    expect(editor.minQuestions).toBe(10);
    expect(editor.weights).toEqual({ lessonPercent: 60, finalPercent: 40 });

    expect(editor.questions.map((question) => question.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(editor.questions[0]?.options).toHaveLength(4);
    expect(editor.questions[0]?.text).toBe("Pertanyaan soal pg");
    expect(editor.questions[0]?.hasKey).toBe(true);
    expect(editor.questions[0]?.hasExplanation).toBe(true);
    expect(editor.questions[1]?.options.map((option) => option.text)).toEqual([
      "Benar",
      "Salah",
    ]);
  });

  it("LESSON path: the owning lesson rides along", async () => {
    const { courseId } = await newDraftCourseWithFinalQuiz();
    const lesson = await createLesson(EDITOR, courseId, {
      title: "Materi editor les",
    });
    await createQuestion(EDITOR, { quizId: lesson.quizId }, PG_INPUT);

    const editor = await getQuizEditor(EDITOR, { quizId: lesson.quizId });
    expect(editor.quiz.type).toBe("LESSON");
    expect(editor.owner.lesson).toEqual({
      id: lesson.id,
      orderIndex: 1,
      title: "Materi editor les",
    });
    expect(editor.questions).toHaveLength(1);
  });

  it("unknown quiz → 404; MEMBER → 403 before parse", async () => {
    await expect(getQuizEditor(EDITOR, { quizId: randomUUID() })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      getQuizEditor(MEMBER, { quizId: randomUUID() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------- rule pass (card S1-08 §1)

describe("findQuestionRuleViolations — the publish gate's rule pass (card S1-08 §1)", () => {
  beforeEach(async () => {
    await seedEditorSettings();
  });

  /** A course whose lesson quiz and Final Quiz each hold 10 stored questions. */
  async function newFilledCourse() {
    const { courseId, finalQuizId } = await newDraftCourseWithFinalQuiz();
    const lesson = await createLesson(EDITOR, courseId, {
      title: "Materi aturan",
    });
    for (let i = 1; i <= 10; i += 1) {
      await createQuestion(EDITOR, { quizId: lesson.quizId }, {
        ...PG_INPUT,
        text: `Pertanyaan materi ${i}`,
        explanation: `Pembahasan materi ${i}`,
      });
    }
    // One benar/salah question rides along: the TRUE_FALSE arm of
    // questionInput must map stored rows just as cleanly.
    await updateQuestion(
      EDITOR,
      { quizId: lesson.quizId, questionId: (await quizQuestionIds(lesson.quizId))[9]!.id },
      {
        type: "TRUE_FALSE",
        text: "Pertanyaan materi benar salah",
        explanation: "Pembahasan benar salah",
        options: [
          { text: "Benar", isCorrect: true },
          { text: "Salah", isCorrect: false },
        ],
      },
    );
    for (let i = 1; i <= 10; i += 1) {
      await createQuestion(EDITOR, { quizId: finalQuizId }, {
        ...PG_INPUT,
        text: `Pertanyaan final ${i}`,
        explanation: `Pembahasan final ${i}`,
      });
    }
    return { courseId, lessonQuizId: lesson.quizId, finalQuizId };
  }

  /** The quiz's stored questions, ordered by order_index. */
  async function quizQuestionIds(quizId: string) {
    return db
      .select({ id: questions.id, orderIndex: questions.orderIndex })
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(questions.orderIndex);
  }

  function firstViolation(violations: Awaited<ReturnType<typeof findQuestionRuleViolations>>) {
    const first = violations[0];
    if (!first) throw new Error("expected at least one violation");
    return first;
  }

  it("passes clean data (PG + benar/salah) inside a transaction", async () => {
    const { lessonQuizId, finalQuizId } = await newFilledCourse();
    const violations = await db.transaction(async (tx) =>
      findQuestionRuleViolations(tx, [
        { quizId: lessonQuizId, label: "Quiz materi 1" },
        { quizId: finalQuizId, label: "Final Quiz" },
      ]),
    );
    expect(violations).toEqual([]);
  });

  it("two answer keys in lesson quiz question 2 → exact label + two-digit number", async () => {
    const { lessonQuizId, finalQuizId } = await newFilledCourse();
    const second = (await quizQuestionIds(lessonQuizId))[1];
    if (!second) throw new Error("second question missing");
    await db
      .update(questionOptions)
      .set({ isCorrect: true })
      .where(
        and(eq(questionOptions.questionId, second.id), eq(questionOptions.orderIndex, 2)),
      );

    const violations = await db.transaction(async (tx) =>
      findQuestionRuleViolations(tx, [
        { quizId: lessonQuizId, label: "Quiz materi 1" },
        { quizId: finalQuizId, label: "Final Quiz" },
      ]),
    );
    expect(violations).toHaveLength(1);
    const first = violations[0];
    if (!first) throw new Error("violation missing");
    expect(first).toEqual({
      quizId: lessonQuizId,
      label: "Quiz materi 1",
      orderIndex: 2,
      message: "Tandai tepat satu kunci jawaban.",
    });
    expect(formatQuizRuleViolation(first)).toBe(
      "Quiz materi 1, soal 02: Tandai tepat satu kunci jawaban.",
    );
  });

  it("NULL explanation in Final Quiz question 1 → \"Pembahasan wajib diisi.\"", async () => {
    const { lessonQuizId, finalQuizId } = await newFilledCourse();
    const first = (await quizQuestionIds(finalQuizId))[0];
    if (!first) throw new Error("first question missing");
    await db
      .update(questions)
      .set({ explanation: null })
      .where(eq(questions.id, first.id));

    const violations = await db.transaction(async (tx) =>
      findQuestionRuleViolations(tx, [
        { quizId: lessonQuizId, label: "Quiz materi 1" },
        { quizId: finalQuizId, label: "Final Quiz" },
      ]),
    );
    expect(formatQuizRuleViolation(firstViolation(violations))).toBe(
      "Final Quiz, soal 01: Pembahasan wajib diisi.",
    );
  });

  it("a 3-option question → \"Pilihan ganda harus punya tepat 4 opsi.\"", async () => {
    const { lessonQuizId } = await newFilledCourse();
    const third = (await quizQuestionIds(lessonQuizId))[2];
    if (!third) throw new Error("third question missing");
    await db
      .delete(questionOptions)
      .where(
        and(eq(questionOptions.questionId, third.id), eq(questionOptions.orderIndex, 4)),
      );

    const violations = await db.transaction(async (tx) =>
      findQuestionRuleViolations(tx, [{ quizId: lessonQuizId, label: "Quiz materi 1" }]),
    );
    expect(formatQuizRuleViolation(firstViolation(violations))).toBe(
      "Quiz materi 1, soal 03: Pilihan ganda harus punya tepat 4 opsi.",
    );
  });

  it("reports lesson quizzes before the Final Quiz (input order, then order_index)", async () => {
    const { lessonQuizId, finalQuizId } = await newFilledCourse();
    const lessonSecond = (await quizQuestionIds(lessonQuizId))[1];
    const finalFirst = (await quizQuestionIds(finalQuizId))[0];
    if (!lessonSecond || !finalFirst) throw new Error("questions missing");
    // Corrupt BOTH: lesson q2 (two keys) and final q1 (NULL explanation).
    await db
      .update(questionOptions)
      .set({ isCorrect: true })
      .where(
        and(
          eq(questionOptions.questionId, lessonSecond.id),
          eq(questionOptions.orderIndex, 2),
        ),
      );
    await db.update(questions).set({ explanation: null }).where(eq(questions.id, finalFirst.id));

    const violations = await db.transaction(async (tx) =>
      findQuestionRuleViolations(tx, [
        { quizId: lessonQuizId, label: "Quiz materi 1" },
        { quizId: finalQuizId, label: "Final Quiz" },
      ]),
    );
    expect(violations).toHaveLength(2);
    expect(formatQuizRuleViolation(firstViolation(violations))).toBe(
      "Quiz materi 1, soal 02: Tandai tepat satu kunci jawaban.",
    );
    expect(formatQuizRuleViolation(violations[1]!)).toBe(
      "Final Quiz, soal 01: Pembahasan wajib diisi.",
    );
  });

  it("an empty quiz list answers [] without querying", async () => {
    const violations = await db.transaction(async (tx) =>
      findQuestionRuleViolations(tx, []),
    );
    expect(violations).toEqual([]);
  });
});
