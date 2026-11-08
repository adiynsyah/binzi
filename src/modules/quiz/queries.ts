// Database access for the quiz domain (cards S1-01, S1-02, S1-09).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
import "server-only";

import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import type { Db } from "@/db/client";
import {
  auditLogs,
  courses,
  lessons,
  questions,
  questionOptions,
  quizzes,
  systemSettings,
} from "@/db/schema";
import { plainTextToDoc } from "@/lib/content-doc";
import { ConflictError, NotFoundError } from "@/lib/errors";

import type { QuestionInput } from "./schema";
import {
  questionAuditSummary,
  toQuestionSummaryDTO,
  type QuestionSummaryDTO,
  type QuizEditorOptionRow,
  type QuizEditorOwnerRow,
  type QuizEditorQuestionRow,
  type QuizEditorQuizRow,
} from "./serializer";

/**
 * Transaction handle type: whatever `db.transaction` hands its callback.
 * Defined here (not in db/client) so the quiz service can re-export it
 * without a circular import.
 */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Insert the empty FINAL quiz that every new course gets (design 21g
 * "Sudah disiapkan kosong"; defaults from card S1-01: 20 minutes, 70%,
 * one attempt, explanations always). The values are editable later in the
 * S3 quiz editor. Runs INSIDE the caller's transaction — hence the tx handle.
 */
export async function insertEmptyFinalQuiz(tx: DbTx): Promise<{ id: string }> {
  const rows = await tx
    .insert(quizzes)
    .values({
      type: "FINAL",
      title: "Final Quiz",
      durationMinutes: 20,
      passingScorePercent: 70,
      maxAttempts: 1,
      explanationPolicy: "ALWAYS",
    })
    .returning({ id: quizzes.id });
  const row = rows[0];
  if (!row) {
    throw new Error("inserting the empty FINAL quiz returned no row");
  }
  return row;
}

/**
 * Insert the empty LESSON quiz that every new lesson gets in the SAME
 * transaction (card S1-02 §1, CRS-06, 21h "otomatis punya satu quiz
 * kosong"): 10 minutes, 70%, ONE attempt (locked for lesson quizzes,
 * §11.4 no. 9), explanations always. `title` = the lesson title at
 * creation time. The S3 quiz editor owns these values afterwards.
 */
export async function insertEmptyLessonQuiz(
  tx: DbTx,
  input: { title: string },
): Promise<{ id: string }> {
  const rows = await tx
    .insert(quizzes)
    .values({
      type: "LESSON",
      title: input.title,
      durationMinutes: 10,
      passingScorePercent: 70,
      maxAttempts: 1,
      explanationPolicy: "ALWAYS",
    })
    .returning({ id: quizzes.id });
  const row = rows[0];
  if (!row) {
    throw new Error("inserting the empty LESSON quiz returned no row");
  }
  return row;
}

/** system_settings key of the publish-time minimum question count (QZ-02). */
export const MIN_QUESTIONS_KEY = "quiz.min_questions";

/**
 * The JSON TEXT of quiz.min_questions (undefined when the row is absent).
 * Selected as ::text and parsed exactly ONCE by the caller: PGlite already
 * parses jsonb and drizzle's jsonb mapping would parse a returned string a
 * SECOND time, silently turning a stored JSON string "10" into the number
 * 10 — exactly the invalid shape the fail-closed check must catch.
 */
export async function selectMinQuestionsText(): Promise<string | undefined> {
  const rows = await db
    .select({ valueText: sql<string | null>`${systemSettings.value}::text` })
    .from(systemSettings)
    .where(eq(systemSettings.key, MIN_QUESTIONS_KEY))
    .limit(1);
  return rows[0]?.valueText ?? undefined;
}

// ------------------------------------------------ score weights (card S1-09)

/** system_settings keys of the score split (§6.4; the results card Sen 16 reuses this). */
export const LESSON_WEIGHT_KEY = "score.lesson_weight";
export const FINAL_WEIGHT_KEY = "score.final_weight";

/**
 * The JSON TEXT of both score weight rows (undefined when absent). Same
 * ::text + parse-ONCE discipline as selectMinQuestionsText — drizzle's
 * jsonb mapping would double-parse a stored JSON string.
 */
export async function selectScoreWeightTexts(): Promise<{
  lessonWeightText: string | undefined;
  finalWeightText: string | undefined;
}> {
  const rows = await db
    .select({
      key: systemSettings.key,
      valueText: sql<string | null>`${systemSettings.value}::text`,
    })
    .from(systemSettings)
    .where(inArray(systemSettings.key, [LESSON_WEIGHT_KEY, FINAL_WEIGHT_KEY]));
  const byKey = new Map(rows.map((row) => [row.key, row.valueText]));
  return {
    lessonWeightText: byKey.get(LESSON_WEIGHT_KEY) ?? undefined,
    finalWeightText: byKey.get(FINAL_WEIGHT_KEY) ?? undefined,
  };
}

// ------------------------------------------- question save (card S1-09 §2)

/**
 * 409 copy for the quiz DRAFT lock (card §2 step 2, agent-proposed —
 * listed in the PR). Twin of NOT_DRAFT_MESSAGE in the course and lesson
 * modules: module-internal copy, not shared behavior.
 */
export const QUIZ_NOT_DRAFT_MESSAGE =
  "Kursus sudah bukan draf — soal quiz terkunci.";

/**
 * The course that owns this quiz: `courses.final_quiz_id` first, then
 * `lessons.quiz_id → lessons.course_id`. Runs INSIDE the caller's
 * transaction BEFORE any lock (card §2 step 1) so the FOR UPDATE targets a
 * plain courses row — no join (a joined FOR UPDATE would lock the lessons
 * row too).
 */
async function findOwnerCourseId(
  tx: DbTx,
  quizId: string,
): Promise<string | undefined> {
  const finalRows = await tx
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.finalQuizId, quizId))
    .limit(1);
  if (finalRows[0]) {
    return finalRows[0].id;
  }
  const lessonRows = await tx
    .select({ courseId: lessons.courseId })
    .from(lessons)
    .where(eq(lessons.quizId, quizId))
    .limit(1);
  return lessonRows[0]?.courseId;
}

/** Lock the owner course + DRAFT gate, shared by both save transactions. */
async function lockOwnerCourse(tx: DbTx, quizId: string): Promise<string> {
  const courseId = await findOwnerCourseId(tx, quizId);
  if (courseId === undefined) {
    throw new NotFoundError("Quiz tidak ditemukan");
  }
  const lockedRows = await tx
    .select({ id: courses.id, status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
    .for("update");
  const course = lockedRows[0];
  if (!course) {
    throw new NotFoundError("Quiz tidak ditemukan");
  }
  if (course.status !== "DRAFT") {
    throw new ConflictError(QUIZ_NOT_DRAFT_MESSAGE);
  }
  return courseId;
}

/** Insert the parsed options 1…n in order (letters A–D derive from it). */
function optionValues(
  questionId: string,
  options: QuestionInput["options"],
) {
  return options.map((option, index) => ({
    questionId,
    orderIndex: index + 1,
    text: option.text,
    isCorrect: option.isCorrect,
  }));
}

/**
 * Create one question in ONE transaction (card §2): owner → lock course →
 * DRAFT gate → order_index = max + 1 under the lock → question + options →
 * course touch → ONE summary-only audit row. Lock order course → question,
 * same as S1-04 course → lesson.
 */
export async function createQuestionTx(input: {
  quizId: string;
  values: QuestionInput;
  actorId: string;
}): Promise<QuestionSummaryDTO> {
  return db.transaction(async (tx) => {
    const courseId = await lockOwnerCourse(tx, input.quizId);

    const maxRows = await tx
      .select({
        max: sql<number>`max(${questions.orderIndex})`.mapWith(Number),
      })
      .from(questions)
      .where(eq(questions.quizId, input.quizId));
    const orderIndex = (maxRows[0]?.max ?? 0) + 1;

    const insertedRows = await tx
      .insert(questions)
      .values({
        quizId: input.quizId,
        orderIndex,
        type: input.values.type,
        text: plainTextToDoc(input.values.text),
        explanation: plainTextToDoc(input.values.explanation),
        points: 1,
        imageUrl: null,
      })
      .returning({
        id: questions.id,
        orderIndex: questions.orderIndex,
        type: questions.type,
        updatedAt: questions.updatedAt,
      });
    const inserted = insertedRows[0];
    if (!inserted) {
      throw new Error("createQuestionTx: insert returned no row");
    }

    await tx.insert(questionOptions).values(
      optionValues(inserted.id, input.values.options),
    );

    await tx
      .update(courses)
      .set({ updatedBy: input.actorId })
      .where(eq(courses.id, courseId));

    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "question.create",
      entityType: "question",
      entityId: inserted.id,
      before: null,
      after: questionAuditSummary({
        quizId: input.quizId,
        type: inserted.type,
        orderIndex,
        optionCount: input.values.options.length,
      }),
      ip: null,
    });

    return toQuestionSummaryDTO(inserted);
  });
}

/**
 * Update one question in ONE transaction (card §2): same owner lock +
 * DRAFT gate, then lock the question row scoped `id AND quiz_id` (a
 * question of another quiz is a 404 — anti-IDOR), update it, REPLACE the
 * options (delete + insert; safe because only DRAFT courses reach here,
 * so no attempt references them), touch the course, one summary audit row.
 */
export async function updateQuestionTx(input: {
  quizId: string;
  questionId: string;
  values: QuestionInput;
  actorId: string;
}): Promise<QuestionSummaryDTO> {
  return db.transaction(async (tx) => {
    const courseId = await lockOwnerCourse(tx, input.quizId);

    const lockedQuestions = await tx
      .select({
        id: questions.id,
        orderIndex: questions.orderIndex,
        type: questions.type,
        updatedAt: questions.updatedAt,
      })
      .from(questions)
      .where(
        and(
          eq(questions.id, input.questionId),
          eq(questions.quizId, input.quizId),
        ),
      )
      .limit(1)
      .for("update");
    const current = lockedQuestions[0];
    if (!current) {
      throw new NotFoundError("Soal tidak ditemukan");
    }

    const oldCountRows = await tx
      .select({ value: count().mapWith(Number) })
      .from(questionOptions)
      .where(eq(questionOptions.questionId, input.questionId));
    const before = questionAuditSummary({
      quizId: input.quizId,
      type: current.type,
      orderIndex: current.orderIndex,
      optionCount: oldCountRows[0]?.value ?? 0,
    });

    const updatedRows = await tx
      .update(questions)
      .set({
        type: input.values.type,
        text: plainTextToDoc(input.values.text),
        explanation: plainTextToDoc(input.values.explanation),
      })
      .where(
        and(
          eq(questions.id, input.questionId),
          eq(questions.quizId, input.quizId),
        ),
      )
      .returning({
        id: questions.id,
        orderIndex: questions.orderIndex,
        type: questions.type,
        updatedAt: questions.updatedAt,
      });
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("updateQuestionTx: update returned no row");
    }

    await tx
      .delete(questionOptions)
      .where(eq(questionOptions.questionId, input.questionId));
    await tx.insert(questionOptions).values(
      optionValues(input.questionId, input.values.options),
    );

    await tx
      .update(courses)
      .set({ updatedBy: input.actorId })
      .where(eq(courses.id, courseId));

    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "question.update",
      entityType: "question",
      entityId: input.questionId,
      before,
      after: questionAuditSummary({
        quizId: input.quizId,
        type: updated.type,
        orderIndex: updated.orderIndex,
        optionCount: input.values.options.length,
      }),
      ip: null,
    });

    return toQuestionSummaryDTO(updated);
  });
}

// -------------------------------------------------- editor page (card §3)

/**
 * The editor page's lookup: quiz + owner in at most two joins (FINAL path
 * first, LESSON path second), then the questions and their options in
 * exactly TWO queries (no N+1). Questions and options come back ordered
 * by order_index — letters A–D derive from this order.
 */
export async function findQuizEditorById(
  quizId: string,
): Promise<
  | {
      quiz: QuizEditorQuizRow;
      owner: QuizEditorOwnerRow;
      questionRows: QuizEditorQuestionRow[];
      optionRows: QuizEditorOptionRow[];
    }
  | undefined
> {
  const quizColumns = {
    id: quizzes.id,
    type: quizzes.type,
    durationMinutes: quizzes.durationMinutes,
    passingScorePercent: quizzes.passingScorePercent,
    shuffleQuestions: quizzes.shuffleQuestions,
    shuffleOptions: quizzes.shuffleOptions,
  };

  const finalRows = await db
    .select({
      ...quizColumns,
      courseId: courses.id,
      courseTitle: courses.title,
      courseStatus: courses.status,
    })
    .from(quizzes)
    .innerJoin(courses, eq(courses.finalQuizId, quizzes.id))
    .where(eq(quizzes.id, quizId))
    .limit(1);

  const finalRow = finalRows[0];
  let quiz: QuizEditorQuizRow;
  let owner: QuizEditorOwnerRow;
  if (finalRow) {
    const { courseId, courseTitle, courseStatus, ...quizRow } = finalRow;
    quiz = quizRow;
    owner = {
      courseId,
      courseTitle,
      courseStatus,
      lessonId: null,
      lessonOrderIndex: null,
      lessonTitle: null,
    };
  } else {
    const lessonRows = await db
      .select({
        ...quizColumns,
        courseId: courses.id,
        courseTitle: courses.title,
        courseStatus: courses.status,
        lessonId: lessons.id,
        lessonOrderIndex: lessons.orderIndex,
        lessonTitle: lessons.title,
      })
      .from(quizzes)
      .innerJoin(lessons, eq(lessons.quizId, quizzes.id))
      .innerJoin(courses, eq(lessons.courseId, courses.id))
      .where(eq(quizzes.id, quizId))
      .limit(1);
    const lessonRow = lessonRows[0];
    if (!lessonRow) {
      return undefined;
    }
    const { courseId, courseTitle, courseStatus, lessonId, lessonOrderIndex, lessonTitle, ...quizRow } =
      lessonRow;
    quiz = quizRow;
    owner = { courseId, courseTitle, courseStatus, lessonId, lessonOrderIndex, lessonTitle };
  }

  const questionRows = await db
    .select({
      id: questions.id,
      orderIndex: questions.orderIndex,
      type: questions.type,
      text: questions.text,
      explanation: questions.explanation,
    })
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderIndex), asc(questions.id));

  const optionRows: QuizEditorOptionRow[] =
    questionRows.length === 0
      ? []
      : await db
          .select({
            questionId: questionOptions.questionId,
            orderIndex: questionOptions.orderIndex,
            text: questionOptions.text,
            isCorrect: questionOptions.isCorrect,
          })
          .from(questionOptions)
          .where(
            inArray(
              questionOptions.questionId,
              questionRows.map((row) => row.id),
            ),
          )
          .orderBy(asc(questionOptions.orderIndex), asc(questionOptions.id));

  return { quiz, owner, questionRows, optionRows };
}
