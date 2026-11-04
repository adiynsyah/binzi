// The ONLY public door of the course module (cards S1-01, S1-02). Routes
// and other modules import functions — and DTO types via `import type` —
// from here; never queries.ts (ESLint-enforced), serializer.ts, or
// policy.ts.
//
// Canonical guard order (src/modules/README.md): these are role-gated
// endpoints, so the role is checked FIRST and input parsing comes after —
// an unauthorized caller never learns the input contract.
//
// Input errors all leave as ZodError with a field path (revision 3 Nov):
// toErrorResponse() then answers 400 VALIDATION_ERROR + fields for schema
// failures and service failures alike — one response shape for every form.
import { NotFoundError } from "@/lib/errors";
import { listLessonOutline, type LessonOutlineItemDTO } from "@/modules/lesson/service";
import { getMinQuestions } from "@/modules/quiz/service";

import { courseFieldError, SIMILAR_TITLE_MESSAGE, SLUG_TAKEN_MESSAGE } from "./errors";
import { evaluatePublishChecklist, type PublishChecklist } from "./checklist";
import { assertCanManageCourses, type Actor } from "./policy";
import * as courseQueries from "./queries";
import {
  createCourseInput,
  getCourseDetailInput,
  listCoursesInput,
  updateCourseInput,
} from "./schema";
import type {
  CmsCourseBuilderDTO,
  CmsCourseDetailDTO,
  CmsCourseListItemDTO,
  CourseStatusCounts,
} from "./serializer";
import {
  toCmsCourseBuilderDTO,
  toCmsCourseDetailDTO,
  toCmsCourseListItemDTO,
} from "./serializer";

// DTO types for consumers: import these from service, not from serializer.
export type {
  CmsCourseBuilderDTO,
  CmsCourseDetailDTO,
  CmsCourseListItemDTO,
  CourseStatusCounts,
  PublishChecklist,
};

/** Everything the builder page needs, from ONE call (card S1-02 §5). */
export type CourseBuilderDTO = {
  course: CmsCourseBuilderDTO;
  outline: LessonOutlineItemDTO[];
  checklist: PublishChecklist;
  minQuestions: number;
};

export type CourseListDTO = {
  items: CmsCourseListItemDTO[];
  /** Totals per status across ALL courses, unaffected by the filter. */
  counts: CourseStatusCounts;
};

/** CMS course list (21e). EDITOR+; role before input parsing. */
export async function listCourses(
  actor: Actor,
  input: unknown,
): Promise<CourseListDTO> {
  assertCanManageCourses(actor);
  const parsed = listCoursesInput.parse(input);

  const [rows, counts] = await Promise.all([
    courseQueries.listCourses(parsed),
    courseQueries.countCoursesByStatus(),
  ]);

  return { items: rows.map(toCmsCourseListItemDTO), counts };
}

/**
 * Create a course: DRAFT row + empty FINAL quiz + audit row, all in one
 * transaction (queries.createCourseWithFinalQuiz). EDITOR+; role before
 * input parsing. Field errors → ZodError (slug taken / title too similar),
 * so the response is 400 VALIDATION_ERROR + fields like a schema failure.
 */
export async function createCourse(
  actor: Actor,
  input: unknown,
): Promise<CmsCourseDetailDTO> {
  assertCanManageCourses(actor);
  const parsed = createCourseInput.parse(input);

  // Similar-title BEFORE the slug check: an identical title also produces
  // an identical auto-slug, and the TITLE error is the one that must show
  // (21f copy) — fixing the title fixes the auto-slug with it (review
  // item 2). Only a hand-edited slug reaches the slug-taken branch.
  const similar = (await courseQueries.listCourseTitles()).find((course) =>
    courseQueries.isSimilarTitle(
      courseQueries.normalizeTitle(parsed.title),
      courseQueries.normalizeTitle(course.title),
    ),
  );
  if (similar) {
    throw courseFieldError("title", SIMILAR_TITLE_MESSAGE(similar.title));
  }

  if (await courseQueries.slugExists(parsed.slug)) {
    throw courseFieldError("slug", SLUG_TAKEN_MESSAGE(parsed.slug));
  }

  return courseQueries.createCourseWithFinalQuiz(parsed, actor.id);
}

/** Builder lookup (21g). EDITOR+; unknown id → 404. */
export async function getCourseDetail(
  actor: Actor,
  input: unknown,
): Promise<CmsCourseDetailDTO> {
  assertCanManageCourses(actor);
  const { courseId } = getCourseDetailInput.parse(input);

  const row = await courseQueries.findCourseById(courseId);
  if (!row) throw new NotFoundError("Kursus tidak ditemukan");
  return toCmsCourseDetailDTO(row);
}

/**
 * The whole builder page in one call (card S1-02 §5): builder DTO + lesson
 * outline + publish-checklist result + the min-questions setting. EDITOR+;
 * unknown id → 404. A missing/invalid quiz.min_questions makes this fail
 * closed (500 via getMinQuestions) — the checklist may never guess a
 * number.
 */
export async function getCourseBuilder(
  actor: Actor,
  input: unknown,
): Promise<CourseBuilderDTO> {
  assertCanManageCourses(actor);
  const { courseId } = getCourseDetailInput.parse(input);

  const row = await courseQueries.findCourseBuilderById(courseId);
  if (!row) throw new NotFoundError("Kursus tidak ditemukan");

  const [outline, minQuestions] = await Promise.all([
    listLessonOutline(courseId),
    getMinQuestions(),
  ]);

  const course = toCmsCourseBuilderDTO(row);
  const checklist = evaluatePublishChecklist({
    title: course.title,
    level: course.level,
    summary: course.summary,
    slug: course.slug,
    isDescriptionEmpty: course.isDescriptionEmpty,
    lessons: outline.map((lesson) => ({
      orderIndex: lesson.orderIndex,
      isContentEmpty: lesson.isContentEmpty,
      quizQuestionCount: lesson.quizQuestionCount,
    })),
    finalQuizQuestionCount: course.finalQuiz?.questionCount ?? 0,
    minQuestions,
  });

  return { course, outline, checklist, minQuestions };
}

/**
 * Save the builder settings form (card S1-02 §2). EDITOR+; role before
 * input parsing. The queries-level transaction re-checks DRAFT after the
 * row lock (409), orders field errors like the form, maps the unique-race
 * to the slug error, and skips both write and audit when nothing changed.
 */
export async function updateCourse(
  actor: Actor,
  courseId: string,
  input: unknown,
): Promise<CmsCourseBuilderDTO> {
  assertCanManageCourses(actor);
  const parsed = updateCourseInput.parse(input);
  const { dto } = await courseQueries.updateCourseIfDraft({
    courseId,
    values: parsed,
    actorId: actor.id,
  });
  return dto;
}
