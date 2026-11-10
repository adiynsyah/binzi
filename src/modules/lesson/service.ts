// The ONLY public door of the lesson module (card S1-02). Routes and other
// modules import functions — and DTO types via `import type` — from here.
//
// Guard order for the role-gated endpoints: role FIRST, input parsing
// after (src/modules/README.md) — an unauthorized caller never learns the
// input contract.
import { NotFoundError } from "@/lib/errors";

import { getMinQuestions, type DbTx } from "@/modules/quiz/service";

import { assertCanManageLessons, type Actor } from "./policy";
import * as lessonQueries from "./queries";
import {
  createLessonInput,
  getLessonInput,
  updateLessonContentInput,
} from "./schema";
import type {
  CreatedLessonDTO,
  LessonChecklistRow,
  LessonEditorDTO,
  LessonOutlineItemDTO,
  UpdatedLessonContentDTO,
} from "./serializer";

// DTO types for consumers: import these from service, not from serializer.
export type {
  CreatedLessonDTO,
  LessonChecklistRow,
  LessonEditorDTO,
  LessonOutlineItemDTO,
  UpdatedLessonContentDTO,
};

/**
 * "Tambah materi" (21h, card §4). EDITOR+; the transaction in
 * createLessonWithQuiz enforces the DRAFT lock after row lock (409) and
 * answers unknown courses with 404.
 */
export async function createLesson(
  actor: Actor,
  courseId: string,
  input: unknown,
): Promise<CreatedLessonDTO> {
  assertCanManageLessons(actor);
  const parsed = createLessonInput.parse(input);
  return lessonQueries.createLessonWithQuiz({
    courseId,
    title: parsed.title,
    actorId: actor.id,
  });
}

/**
 * Builder outline for getCourseBuilder (course module). No actor gate of
 * its own: the single caller (course service getCourseBuilder) has already
 * asserted EDITOR+, and EDITOR+ may see every course (S1-01 decision).
 */
export async function listLessonOutline(
  courseId: string,
): Promise<LessonOutlineItemDTO[]> {
  return lessonQueries.listOutlineByCourseId(courseId);
}

/**
 * Checklist rows for the publish gate (card S1-08 §1): the SAME outline
 * statement the builder page uses, executed inside the caller's
 * submit/publish transaction AFTER its course lock — the gate reads what
 * the builder shows (one checklist source, owner review addition 2).
 */
export async function listLessonChecklistRows(
  tx: DbTx,
  courseId: string,
): Promise<LessonChecklistRow[]> {
  return lessonQueries.listChecklistRows(tx, courseId);
}

/**
 * Lesson editor lookup (placeholder page, card §4): EDITOR+; a lesson that
 * does not exist OR belongs to another course is a 404 (anti-IDOR shape:
 * existence is not confirmed).
 */
export async function getLessonInCourse(
  actor: Actor,
  input: unknown,
): Promise<{ id: string; title: string }> {
  assertCanManageLessons(actor);
  const { courseId, lessonId } = getLessonInput.parse(input);

  const row = await lessonQueries.findLessonTitleInCourse(courseId, lessonId);
  if (!row) throw new NotFoundError("Materi tidak ditemukan");
  return row;
}

/**
 * The lesson editor page's data (card S1-04 §5 + S1-09 §5): EDITOR+;
 * unknown lesson, unknown course, or a lesson belonging to another course
 * → 404. The stored document is validated in the serializer — a row that
 * somehow fails the validator comes back with lesson.content null and the
 * page answers "Isi materi ini tidak bisa dibuka editor." instead of
 * opening the editor. The quiz columns feed the page's quiz block; the
 * publish minimum comes from the quiz module (fail-closed there).
 */
export async function getLessonEditor(
  actor: Actor,
  input: unknown,
): Promise<LessonEditorDTO> {
  assertCanManageLessons(actor);
  const { courseId, lessonId } = getLessonInput.parse(input);

  const minQuestions = await getMinQuestions();
  const row = await lessonQueries.findLessonEditorById(
    courseId,
    lessonId,
    minQuestions,
  );
  if (!row) throw new NotFoundError("Materi tidak ditemukan");
  return row;
}

/**
 * Save the lesson text (card S1-04 §2). EDITOR+; role before input
 * parsing. The parsed value IS the validator-rebuilt document — exactly
 * what updateLessonContentIfDraft stores (never the raw request input).
 */
export async function updateLessonContent(
  actor: Actor,
  ids: { courseId: string; lessonId: string },
  input: unknown,
): Promise<UpdatedLessonContentDTO> {
  assertCanManageLessons(actor);
  const parsed = updateLessonContentInput.parse(input);
  const { dto } = await lessonQueries.updateLessonContentIfDraft({
    courseId: ids.courseId,
    lessonId: ids.lessonId,
    values: parsed,
    actorId: actor.id,
  });
  return dto;
}
