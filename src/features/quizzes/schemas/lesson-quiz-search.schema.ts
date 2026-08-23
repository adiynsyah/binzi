import { z } from "zod";

/**
 * Lesson Quiz builder Question-search URL query schema (TASK 033,
 * Blueprint §14 "Zod at external boundaries").
 *
 * Mirrors the TASK 028 lesson-content search schema, but under its OWN
 * parameter names (`qq` / `qpage`) — the lesson editor route already
 * serves the Content picker's `q` / `page`, and the two panels must be
 * able to filter independently in one URL. Any malformed input
 * normalizes to the unfiltered first page so the editor always renders
 * predictably. Unknown keys (the content picker's `q`/`page`, the
 * mutation feedback `error` flag) are simply not read here.
 */

export const lessonQuizSearchQuerySchema = z.object({
  qq: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      // Overlong queries degrade to "no search", not a full reset.
      return trimmed === "" || trimmed.length > 200 ? undefined : trimmed;
    },
    z.string().min(1).max(200).optional(),
  ),
  qpage: z.preprocess(
    (value) => {
      if (value === undefined || value === "") return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    },
    // The inner schema must itself accept undefined: in zod 4 an
    // .optional() chained after z.preprocess does not shield the
    // inner schema from the preprocess output.
    z.coerce.number().int().min(1).max(10_000).optional(),
  ),
});

export type LessonQuizSearchQuery = z.infer<
  typeof lessonQuizSearchQuerySchema
>;

/** Collapsed view of Next.js searchParams values (first value wins). */
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses raw Next.js search params into a normalized question-search
 * query. Always succeeds: malformed input falls back to page 1 with no
 * query.
 */
export function parseLessonQuizSearchParams(
  searchParams: SearchParamsRecord,
): LessonQuizSearchQuery {
  const parsed = lessonQuizSearchQuerySchema.safeParse({
    qq: firstValue(searchParams.qq),
    qpage: firstValue(searchParams.qpage),
  });

  if (!parsed.success) {
    return {};
  }

  return parsed.data;
}
