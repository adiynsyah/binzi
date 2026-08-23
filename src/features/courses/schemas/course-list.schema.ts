import { z } from "zod";

import { publicationStatus } from "@/db/schema/enums";

/**
 * Course List URL query schema (TASK 022, CMS Spec §5, Blueprint §14
 * "Zod at external boundaries" — URL search params are an external
 * boundary).
 *
 * Enum values are derived from the Drizzle schema enum so the filter
 * vocabulary can never drift from the database definition (courses
 * share the publication_status enum with Content/Lessons). Unknown
 * status values normalize to "no filter" and invalid pages normalize
 * to 1 — the list always renders predictably. Mirrors the TASK 016
 * Content List query schema minus the Content-only type filter.
 */

export const courseListQuerySchema = z.object({
  q: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      // Overlong queries degrade to "no search", not a full reset.
      return trimmed === "" || trimmed.length > 200 ? undefined : trimmed;
    },
    z.string().min(1).max(200).optional(),
  ),
  status: z
    .enum(publicationStatus.enumValues)
    .optional()
    .catch(undefined),
  page: z.preprocess(
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

export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

/** Collapsed view of Next.js searchParams values (first value wins). */
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses raw Next.js search params into a normalized Course List
 * query. Always succeeds: any malformed input falls back to the
 * unfiltered first page.
 */
export function parseCourseListSearchParams(
  searchParams: SearchParamsRecord,
): CourseListQuery {
  const parsed = courseListQuerySchema.safeParse({
    q: firstValue(searchParams.q),
    status: firstValue(searchParams.status),
    page: firstValue(searchParams.page),
  });

  if (!parsed.success) {
    return {};
  }

  return parsed.data;
}
