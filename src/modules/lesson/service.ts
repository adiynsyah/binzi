// The ONLY public door of the lesson module (card S1-02). Routes and other
// modules import functions — and DTO types via `import type` — from here.
//
// Guard order for the role-gated endpoints: role FIRST, input parsing
// after (src/modules/README.md) — an unauthorized caller never learns the
// input contract.
import { NotFoundError } from "@/lib/errors";

import { assertCanManageLessons, type Actor } from "./policy";
import * as lessonQueries from "./queries";
import { createLessonInput, getLessonInput } from "./schema";
import type { CreatedLessonDTO, LessonOutlineItemDTO } from "./serializer";

// DTO types for consumers: import these from service, not from serializer.
export type { CreatedLessonDTO, LessonOutlineItemDTO };

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
