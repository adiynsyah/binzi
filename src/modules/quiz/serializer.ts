// Explicit serialization for the quiz module (PRD §12.6, card S1-09).
//
// Module-internal: consumers outside the module get DTO types re-exported
// from service.ts. Audiences and DTOs:
// - QuestionSummaryDTO: the 201/200 answer of the two question endpoints —
//   id/orderIndex/type/updatedAt ONLY. Text, options, and the key never
//   come back (the editor keeps what it typed; nothing leaks).
// - QuizEditorDTO: the /cms/quiz/{quizId} page. Key + explanation ARE part
//   of this DTO deliberately: the page is EDITOR+ staff (CLAUDE.md's
//   "never before submit" rule governs the participant path, which must
//   not reuse this DTO).
//
// Type-only db imports + the pure @/lib/content-doc: serializer tests run
// without DATABASE_URL.
import type { courses, questions, questionOptions, quizzes } from "@/db/schema";
import { docToPlainText, isDocEmpty } from "@/lib/content-doc";

// ------------------------------------------------------------ save endpoints

export type QuestionSummaryRow = Pick<
  typeof questions.$inferSelect,
  "id" | "orderIndex" | "type" | "updatedAt"
>;

/** 201 (POST) / 200 (PATCH) response body `data`. */
export type QuestionSummaryDTO = {
  id: string;
  orderIndex: number;
  type: QuestionSummaryRow["type"];
  updatedAt: string;
};

export function toQuestionSummaryDTO(row: QuestionSummaryRow): QuestionSummaryDTO {
  return {
    id: row.id,
    orderIndex: row.orderIndex,
    type: row.type,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Audit summaries (card §2 step 6): counts only — never question text,
 *  option text, the key, or the explanation (S1-02 review rule 2a). */
export type QuestionAuditSummary = {
  quizId: string;
  type: QuestionSummaryRow["type"];
  orderIndex: number;
  optionCount: number;
};

export function questionAuditSummary(input: {
  quizId: string;
  type: QuestionSummaryRow["type"];
  orderIndex: number;
  optionCount: number;
}): QuestionAuditSummary {
  return { ...input };
}

// ------------------------------------------------------------- editor page

export type QuizEditorQuizRow = Pick<
  typeof quizzes.$inferSelect,
  | "id"
  | "type"
  | "durationMinutes"
  | "passingScorePercent"
  | "shuffleQuestions"
  | "shuffleOptions"
>;

export type QuizEditorOwnerRow = {
  courseId: string;
  courseTitle: string;
  courseStatus: Pick<typeof courses.$inferSelect, "status">["status"];
  lessonId: string | null;
  lessonOrderIndex: number | null;
  lessonTitle: string | null;
};

export type QuizEditorQuestionRow = Pick<
  typeof questions.$inferSelect,
  "id" | "orderIndex" | "type" | "text" | "explanation"
>;

/** Options of MANY questions at once (one query for the whole list). */
export type QuizEditorOptionRow = Pick<
  typeof questionOptions.$inferSelect,
  "questionId" | "orderIndex" | "text" | "isCorrect"
>;

export type QuizEditorQuestionDTO = {
  id: string;
  orderIndex: number;
  type: QuizEditorQuestionRow["type"];
  /** Plain text (docToPlainText) — the dialog edits plain text (decision 3). */
  text: string;
  explanation: string;
  /** Already ordered A–D by order_index; the letter is derived, not stored. */
  options: { text: string; isCorrect: boolean }[];
  /** Exactly one correct option (legacy rows may violate — the row then
   *  renders in its danger-tint shape). */
  hasKey: boolean;
  hasExplanation: boolean;
};

export type ScoreWeights = { lessonPercent: number; finalPercent: number };

export type QuizEditorDTO = {
  quiz: {
    id: string;
    type: QuizEditorQuizRow["type"];
    durationMinutes: number;
    passingScorePercent: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
  owner: {
    courseId: string;
    courseTitle: string;
    courseStatus: QuizEditorOwnerRow["courseStatus"];
    /** null for a FINAL quiz; the owning lesson for a LESSON quiz. */
    lesson: { id: string; orderIndex: number; title: string } | null;
  };
  questions: QuizEditorQuestionDTO[];
  minQuestions: number;
  weights: ScoreWeights;
};

/**
 * Assembles the page DTO. Question rows keep their query order
 * (order_index); each question's options are the rows whose questionId
 * matches, in the order they were passed (also order_index — the caller
 * sorted once, no per-question re-sort here).
 */
export function toQuizEditorDTO(input: {
  quiz: QuizEditorQuizRow;
  owner: QuizEditorOwnerRow;
  questionRows: QuizEditorQuestionRow[];
  optionRows: QuizEditorOptionRow[];
  minQuestions: number;
  weights: ScoreWeights;
}): QuizEditorDTO {
  const byQuestion = new Map<string, QuizEditorOptionRow[]>();
  for (const option of input.optionRows) {
    const bucket = byQuestion.get(option.questionId);
    if (bucket) {
      bucket.push(option);
    } else {
      byQuestion.set(option.questionId, [option]);
    }
  }

  const questions: QuizEditorQuestionDTO[] = input.questionRows.map((row) => {
    const options = (byQuestion.get(row.id) ?? []).map((option) => ({
      text: option.text,
      isCorrect: option.isCorrect,
    }));
    return {
      id: row.id,
      orderIndex: row.orderIndex,
      type: row.type,
      text: docToPlainText(row.text),
      explanation: docToPlainText(row.explanation),
      options,
      hasKey: options.filter((option) => option.isCorrect).length === 1,
      hasExplanation: !isDocEmpty(row.explanation),
    };
  });

  const lesson =
    input.owner.lessonId !== null &&
    input.owner.lessonOrderIndex !== null &&
    input.owner.lessonTitle !== null
      ? {
          id: input.owner.lessonId,
          orderIndex: input.owner.lessonOrderIndex,
          title: input.owner.lessonTitle,
        }
      : null;

  return {
    quiz: {
      id: input.quiz.id,
      type: input.quiz.type,
      durationMinutes: input.quiz.durationMinutes,
      passingScorePercent: input.quiz.passingScorePercent,
      shuffleQuestions: input.quiz.shuffleQuestions,
      shuffleOptions: input.quiz.shuffleOptions,
    },
    owner: {
      courseId: input.owner.courseId,
      courseTitle: input.owner.courseTitle,
      courseStatus: input.owner.courseStatus,
      lesson,
    },
    questions,
    minQuestions: input.minQuestions,
    weights: input.weights,
  };
}
