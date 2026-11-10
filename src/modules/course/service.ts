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
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { roleAtLeast } from "@/lib/rbac";
import { listLessonOutline, type LessonOutlineItemDTO } from "@/modules/lesson/service";
import { getMinQuestions } from "@/modules/quiz/service";

import {
  courseFieldError,
  PUBLISH_FORBIDDEN_MESSAGE,
  SIMILAR_TITLE_MESSAGE,
  SLUG_TAKEN_MESSAGE,
  SUBMIT_FORBIDDEN_MESSAGE,
} from "./errors";
import {
  evaluatePublishChecklist,
  publishChecklistInputFrom,
  type PublishChecklist,
} from "./checklist";
import {
  assertCanManageCourses,
  courseActionsFor,
  canPublishRole,
  canSubmitRole,
  type Actor,
  type CourseActions,
} from "./policy";
import * as courseQueries from "./queries";
import {
  createCourseInput,
  getCourseDetailInput,
  listCoursesInput,
  updateCourseDescriptionInput,
  updateCourseInput,
} from "./schema";
import type {
  CmsCourseBuilderDTO,
  CmsCourseDetailDTO,
  CmsCourseListItemDTO,
  CourseApprovalQueueItemDTO,
  CourseDescriptionEditorDTO,
  CourseReviewDTO,
  CourseStatusCounts,
  UpdatedCourseDescriptionDTO,
} from "./serializer";
import {
  toCmsCourseBuilderDTO,
  toCmsCourseDetailDTO,
  toCmsCourseListItemDTO,
  toCourseReviewDTO,
} from "./serializer";

// DTO types for consumers: import these from service, not from serializer.
export type {
  CmsCourseBuilderDTO,
  CmsCourseDetailDTO,
  CmsCourseListItemDTO,
  CourseApprovalQueueItemDTO,
  CourseDescriptionEditorDTO,
  CourseReviewDTO,
  CourseStatusCounts,
  CourseActions,
  PublishChecklist,
  UpdatedCourseDescriptionDTO,
};

/** Everything the builder page needs, from ONE call (card S1-02 §5). */
export type CourseBuilderDTO = {
  course: CmsCourseBuilderDTO;
  outline: LessonOutlineItemDTO[];
  checklist: PublishChecklist;
  minQuestions: number;
  /** Who sent the course and when (card S1-08 §3); null before submit. */
  review: CourseReviewDTO | null;
  /** Which top-bar actions render — same policy source as the gates. */
  actions: CourseActions;
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
  // ONE input builder for page and gate (owner review addition 2).
  const checklist = evaluatePublishChecklist(
    publishChecklistInputFrom(
      {
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
      },
      minQuestions,
    ),
  );

  return {
    course,
    outline,
    checklist,
    minQuestions,
    review: toCourseReviewDTO(row),
    actions: courseActionsFor(actor.role, course.status),
  };
}

// -------------------------------------- submit & publish (card S1-08 §2)

/**
 * Kirim untuk persetujuan (card §2). The route checks role (EDITOR+) and
 * the UUID shape; HERE the exact-role gate runs before anything else —
 * ADMIN/SUPER_ADMIN are 403 too, because submitting is the ahli gizi's
 * act. minQuestions is read BEFORE the transaction (fail-closed 500, same
 * as the builder); the transaction then locks, gates, updates, and audits.
 */
export async function submitCourse(
  actor: Actor,
  courseId: string,
): Promise<CmsCourseBuilderDTO> {
  if (!canSubmitRole(actor.role)) {
    throw new ForbiddenError(SUBMIT_FORBIDDEN_MESSAGE);
  }
  const minQuestions = await getMinQuestions();
  return courseQueries.submitCourseTx({
    courseId,
    actorId: actor.id,
    minQuestions,
  });
}

/**
 * Setujui & terbitkan (card §2). Second role layer after the route's
 * requireApiRole("ADMIN"); the transaction re-runs the FULL gate (the
 * min-questions setting or the data may have moved since submit) and
 * never touches reviewer_id/reviewed_at.
 */
export async function publishCourse(
  actor: Actor,
  courseId: string,
): Promise<CmsCourseBuilderDTO> {
  if (!canPublishRole(actor.role)) {
    throw new ForbiddenError(PUBLISH_FORBIDDEN_MESSAGE);
  }
  const minQuestions = await getMinQuestions();
  return courseQueries.publishCourseTx({
    courseId,
    actorId: actor.id,
    minQuestions,
  });
}

/**
 * The /cms/konten queue (card §6): EDITOR+ (role checked before any
 * query); ADMIN+ sees every IN_REVIEW course, an EDITOR only their own
 * submissions (reviewer_id = actor.id).
 */
export async function listCourseApprovalQueue(
  actor: Actor,
): Promise<CourseApprovalQueueItemDTO[]> {
  assertCanManageCourses(actor);
  return courseQueries.listApprovalQueue(
    roleAtLeast(actor.role, "ADMIN") ? {} : { reviewerId: actor.id },
  );
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

/**
 * Save the course description (card S1-04 §3). EDITOR+; role before input
 * parsing (same guard order as updateCourse). The parsed value IS the
 * validator-rebuilt document — exactly what the transaction stores.
 */
export async function updateCourseDescription(
  actor: Actor,
  courseId: string,
  input: unknown,
): Promise<UpdatedCourseDescriptionDTO> {
  assertCanManageCourses(actor);
  const parsed = updateCourseDescriptionInput.parse(input);
  const { dto } = await courseQueries.updateCourseDescriptionIfDraft({
    courseId,
    values: parsed,
    actorId: actor.id,
  });
  return dto;
}

/**
 * The description editor page's data (card S1-04 §6): EDITOR+; unknown
 * course → 404. A stored null description maps to EMPTY_DOC; a row that
 * somehow fails the validator comes back with description null and the
 * page answers "Deskripsi ini tidak bisa dibuka editor.".
 */
export async function getCourseDescriptionEditor(
  actor: Actor,
  input: unknown,
): Promise<CourseDescriptionEditorDTO> {
  assertCanManageCourses(actor);
  const { courseId } = getCourseDetailInput.parse(input);

  const row = await courseQueries.findCourseDescriptionEditorById(courseId);
  if (!row) throw new NotFoundError("Kursus tidak ditemukan");
  return row;
}
