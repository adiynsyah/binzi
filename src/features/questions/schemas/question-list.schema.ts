import { z } from "zod";

/**
 * Question Bank List URL query schema (TASK 030, CMS Spec §22,
 * Blueprint §14 "Zod at external boundaries" — URL search params are
 * an external boundary).
 *
 * The Question Bank has NO filterable enum columns: questions carry
 * no publication status and no type (Drizzle Spec §11 — status-free
 * by approved decision). The only URL state is the free-text search
 * `q` (matched against question_text) and the `page` number.
 *
 * Values are derived from nothing — the vocabulary cannot drift.
 * Malformed input always normalizes: overlong queries degrade to
 * "no search" and invalid pages degrade to 1, so the list always
 * renders predictably (TASK 016 convention).
 */
export const questionListQuerySchema = z.object({
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

export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;

/** Collapsed view of Next.js searchParams values (first value wins). */
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses raw Next.js search params into a normalized Question Bank
 * query. Always succeeds: any malformed input falls back to the
 * unfiltered first page.
 */
export function parseQuestionListSearchParams(
  searchParams: SearchParamsRecord,
): QuestionListQuery {
  const parsed = questionListQuerySchema.safeParse({
    q: firstValue(searchParams.q),
    page: firstValue(searchParams.page),
  });

  if (!parsed.success) {
    return {};
  }

  return parsed.data;
}
