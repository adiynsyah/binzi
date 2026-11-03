// The ONLY public door of the course module (card S1-01). Routes and other
// modules import functions — and DTO types via `import type` — from here;
// never queries.ts (ESLint-enforced), serializer.ts, or policy.ts.
//
// Canonical guard order (src/modules/README.md): these are role-gated
// endpoints, so the role is checked FIRST and input parsing comes after —
// an unauthorized caller never learns the input contract.
//
// Input errors all leave as ZodError with a field path (revision 3 Nov):
// toErrorResponse() then answers 400 VALIDATION_ERROR + fields for schema
// failures and service failures alike — one response shape for every form.
import { NotFoundError } from "@/lib/errors";

import { courseFieldError, SIMILAR_TITLE_MESSAGE, SLUG_TAKEN_MESSAGE } from "./errors";
import { assertCanManageCourses, type Actor } from "./policy";
import * as courseQueries from "./queries";
import type { CourseStatusCounts } from "./queries";
import {
  createCourseInput,
  getCourseDetailInput,
  listCoursesInput,
} from "./schema";
import type { CmsCourseDetailDTO, CmsCourseListItemDTO } from "./serializer";
import { toCmsCourseDetailDTO, toCmsCourseListItemDTO } from "./serializer";

// DTO types for consumers: import these from service, not from serializer.
export type { CmsCourseDetailDTO, CmsCourseListItemDTO, CourseStatusCounts };

/** Lowercase + collapsed spaces — the similar-title comparison form (21f). */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Is one normalized title a prefix of the other (equal counts too)? */
function isSimilarTitle(candidate: string, existing: string): boolean {
  return existing.startsWith(candidate) || candidate.startsWith(existing);
}

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

  if (await courseQueries.slugExists(parsed.slug)) {
    throw courseFieldError("slug", SLUG_TAKEN_MESSAGE(parsed.slug));
  }

  const similar = (await courseQueries.listCourseTitles()).find((course) =>
    isSimilarTitle(normalizeTitle(parsed.title), normalizeTitle(course.title)),
  );
  if (similar) {
    throw courseFieldError("title", SIMILAR_TITLE_MESSAGE(similar.title));
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
