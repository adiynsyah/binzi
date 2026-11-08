// Serializer tests for the quiz module (card S1-09): option grouping in
// query order, hasKey/hasExplanation derivations, and the owner lesson
// shape. Pure functions — no DATABASE_URL needed.
import { describe, expect, it } from "vitest";

import {
  toQuestionSummaryDTO,
  toQuizEditorDTO,
  type QuizEditorOptionRow,
  type QuizEditorOwnerRow,
  type QuizEditorQuestionRow,
  type QuizEditorQuizRow,
} from "./serializer";

const quiz: QuizEditorQuizRow = {
  id: "q-1",
  type: "LESSON",
  durationMinutes: 10,
  passingScorePercent: 70,
  shuffleQuestions: false,
  shuffleOptions: false,
};

const owner: QuizEditorOwnerRow = {
  courseId: "c-1",
  courseTitle: "Dasar Gizi Ibu Hamil",
  courseStatus: "DRAFT",
  lessonId: null,
  lessonOrderIndex: null,
  lessonTitle: null,
};

function questionRow(
  overrides: Partial<QuizEditorQuestionRow> = {},
): QuizEditorQuestionRow {
  return {
    id: "qq-1",
    orderIndex: 1,
    type: "SINGLE_CHOICE",
    text: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Baris satu" }] }] },
    explanation: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Baris satu" }] },
        { type: "paragraph", content: [{ type: "text", text: "Baris dua" }] },
      ],
    },
    ...overrides,
  };
}

function optionRow(
  overrides: Partial<QuizEditorOptionRow> = {},
): QuizEditorOptionRow {
  return {
    questionId: "qq-1",
    orderIndex: 1,
    text: "Benar sekali",
    isCorrect: false,
    ...overrides,
  };
}

describe("toQuestionSummaryDTO", () => {
  it("answers id/orderIndex/type + ISO updatedAt only", () => {
    expect(
      toQuestionSummaryDTO({
        id: "qq-9",
        orderIndex: 3,
        type: "TRUE_FALSE",
        updatedAt: new Date("2026-11-08T02:04:00.000Z"),
      }),
    ).toEqual({
      id: "qq-9",
      orderIndex: 3,
      type: "TRUE_FALSE",
      updatedAt: "2026-11-08T02:04:00.000Z",
    });
  });
});

describe("toQuizEditorDTO (card S1-09 §3)", () => {
  it("groups options by questionId in the PASSED order (A–D derive from it)", () => {
    const dto = toQuizEditorDTO({
      quiz,
      owner,
      questionRows: [questionRow()],
      optionRows: [
        optionRow({ orderIndex: 1, text: "Opsi A", isCorrect: true }),
        optionRow({ orderIndex: 2, text: "Opsi B" }),
        optionRow({ orderIndex: 3, text: "Opsi C" }),
        optionRow({ orderIndex: 4, text: "Opsi D" }),
      ],
      minQuestions: 10,
      weights: { lessonPercent: 60, finalPercent: 40 },
    });

    expect(dto.questions[0]?.options).toEqual([
      { text: "Opsi A", isCorrect: true },
      { text: "Opsi B", isCorrect: false },
      { text: "Opsi C", isCorrect: false },
      { text: "Opsi D", isCorrect: false },
    ]);
    expect(dto.questions[0]?.hasKey).toBe(true);
    expect(dto.questions[0]?.hasExplanation).toBe(true);
    // Plain text via docToPlainText: one line per paragraph.
    expect(dto.questions[0]?.text).toBe("Baris satu");
    expect(dto.questions[0]?.explanation).toBe("Baris satu\nBaris dua");
  });

  it("a question with NO options has hasKey false (legacy danger row)", () => {
    const dto = toQuizEditorDTO({
      quiz,
      owner,
      questionRows: [questionRow()],
      optionRows: [],
      minQuestions: 10,
      weights: { lessonPercent: 60, finalPercent: 40 },
    });
    expect(dto.questions[0]?.options).toEqual([]);
    expect(dto.questions[0]?.hasKey).toBe(false);
  });

  it("TWO correct options → hasKey false (legacy danger row)", () => {
    const dto = toQuizEditorDTO({
      quiz,
      owner,
      questionRows: [questionRow()],
      optionRows: [
        optionRow({ orderIndex: 1, isCorrect: true }),
        optionRow({ orderIndex: 2, isCorrect: true }),
      ],
      minQuestions: 10,
      weights: { lessonPercent: 60, finalPercent: 40 },
    });
    expect(dto.questions[0]?.hasKey).toBe(false);
  });

  it("an empty explanation doc → hasExplanation false", () => {
    const dto = toQuizEditorDTO({
      quiz,
      owner,
      questionRows: [
        questionRow({
          explanation: { type: "doc", content: [{ type: "paragraph" }] },
        }),
      ],
      optionRows: [optionRow({ isCorrect: true })],
      minQuestions: 10,
      weights: { lessonPercent: 60, finalPercent: 40 },
    });
    expect(dto.questions[0]?.hasExplanation).toBe(false);
  });

  it("a null explanation column → hasExplanation false, explanation ''", () => {
    const dto = toQuizEditorDTO({
      quiz,
      owner,
      questionRows: [questionRow({ explanation: null })],
      optionRows: [optionRow({ isCorrect: true })],
      minQuestions: 10,
      weights: { lessonPercent: 60, finalPercent: 40 },
    });
    expect(dto.questions[0]?.hasExplanation).toBe(false);
    expect(dto.questions[0]?.explanation).toBe("");
  });

  it("keeps questions in ROW order and splits options across questions", () => {
    const dto = toQuizEditorDTO({
      quiz,
      owner,
      questionRows: [
        questionRow({ id: "qq-1", orderIndex: 1 }),
        questionRow({ id: "qq-2", orderIndex: 2, type: "TRUE_FALSE" }),
      ],
      optionRows: [
        optionRow({ questionId: "qq-1", orderIndex: 1 }),
        optionRow({ questionId: "qq-2", orderIndex: 1, text: "Benar", isCorrect: true }),
        optionRow({ questionId: "qq-2", orderIndex: 2, text: "Salah" }),
      ],
      minQuestions: 10,
      weights: { lessonPercent: 60, finalPercent: 40 },
    });
    expect(dto.questions.map((question) => question.id)).toEqual([
      "qq-1",
      "qq-2",
    ]);
    expect(dto.questions[1]?.options).toEqual([
      { text: "Benar", isCorrect: true },
      { text: "Salah", isCorrect: false },
    ]);
  });

  it("FINAL owner → lesson null; LESSON owner → the lesson triple", () => {
    const final = toQuizEditorDTO({
      quiz: { ...quiz, type: "FINAL" },
      owner,
      questionRows: [],
      optionRows: [],
      minQuestions: 10,
      weights: { lessonPercent: 60, finalPercent: 40 },
    });
    expect(final.owner.lesson).toBeNull();

    const lesson = toQuizEditorDTO({
      quiz,
      owner: {
        ...owner,
        lessonId: "l-1",
        lessonOrderIndex: 2,
        lessonTitle: "Materi kedua",
      },
      questionRows: [],
      optionRows: [],
      minQuestions: 10,
      weights: { lessonPercent: 60, finalPercent: 40 },
    });
    expect(lesson.owner.lesson).toEqual({
      id: "l-1",
      orderIndex: 2,
      title: "Materi kedua",
    });
  });
});
