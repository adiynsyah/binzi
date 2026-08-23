import { z } from "zod";

/**
 * Lesson editor Content-search URL query schema (TASK 028, Blueprint §14
 * "Zod at external boundaries" — URL search params are an external
 * boundary).
 *
 * Mirrors the TASK 016 content-list schema but keeps only the fields
 * the assignment picker needs: a title query and a page number. Any
 * malformed input normalizes to the unfiltered first page so the
 * editor always renders predictably.
 */
export const lessonContentSearchQuerySchema = z.object({
  q: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      // Overlong queries degrade to "no search", not a full reset.
      return trimmed === "" || trimmed.length > 200 ? undefined : trimmed;
    },
    z.string().min(1).max(200).optional(),
  ),
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

export type LessonContentSearchQuery = z.infer<
  typeof lessonContentSearchQuerySchema
>;

/** Collapsed view of Next.js searchParams values (first value wins). */
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses raw Next.js search params into a normalized assignment-search
 * query. Always succeeds: malformed input falls back to page 1 with no
 * query. Unknown keys (including the mutation feedback `error` flag)
 * are simply not read here.
 */
export function parseLessonContentSearchParams(
  searchParams: SearchParamsRecord,
): LessonContentSearchQuery {
  const parsed = lessonContentSearchQuerySchema.safeParse({
    q: firstValue(searchParams.q),
    page: firstValue(searchParams.page),
  });

  if (!parsed.success) {
    return {};
  }

  return parsed.data;
}
