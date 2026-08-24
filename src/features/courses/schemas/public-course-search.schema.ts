import { z } from "zod";

/**
 * Public Course Catalog URL query schema (TASK 038, UI/UX §6 "Course
 * Catalog", Blueprint §14 "Zod at external boundaries" — URL search
 * params are an external boundary).
 *
 * The catalog owns exactly one public parameter: the free-text search
 * `q` (Task Plan 038 "Search"). Difficulty filtering is Task Plan
 * "if approved" with no approval recorded in the source documents, so
 * no filter parameter exists here (TASK 038 FLAG). Parsing always
 * succeeds: an overlong or non-string `q` degrades to "no search",
 * mirroring the CMS course-list schema convention.
 */
export const publicCourseSearchSchema = z.object({
  q: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      // Overlong queries degrade to "no search", not a full reset.
      return trimmed === "" || trimmed.length > 200 ? undefined : trimmed;
    },
    z.string().min(1).max(200).optional(),
  ),
});

export type PublicCourseSearchQuery = z.infer<typeof publicCourseSearchSchema>;

/** Collapsed view of Next.js searchParams values (first value wins). */
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses raw Next.js search params into a normalized catalog query.
 * Always succeeds: any malformed input falls back to the unfiltered
 * catalog.
 */
export function parsePublicCourseSearchParams(
  searchParams: SearchParamsRecord,
): PublicCourseSearchQuery {
  const parsed = publicCourseSearchSchema.safeParse({
    q: firstValue(searchParams.q),
  });

  if (!parsed.success) {
    return {};
  }

  return parsed.data;
}
