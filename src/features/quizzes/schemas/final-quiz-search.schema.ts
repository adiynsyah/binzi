import { z } from "zod";

import type { LessonQuizSearchQuery } from "./lesson-quiz-search.schema";

/**
 * Final Quiz builder Question-search URL query schema (TASK 034,
 * Blueprint §14 "Zod at external boundaries").
 *
 * Same normalized shape as the TASK 033 lesson-quiz search schema —
 * the consumer (searchBankQuestions) is generic over the quiz — but
 * under the Course Builder's OWN parameter names (`fq` / `fqpage`),
 * namespaced per the TASK 034 URL contract so this panel's filter
 * state can never be confused with another route's or panel's. Any
 * malformed input normalizes to the unfiltered first page so the
 * Course Builder always renders predictably.
 */

export const finalQuizSearchQuerySchema = z.object({
  fq: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      // Overlong queries degrade to "no search", not a full reset.
      return trimmed === "" || trimmed.length > 200 ? undefined : trimmed;
    },
    z.string().min(1).max(200).optional(),
  ),
  fqpage: z.preprocess(
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

/** URL-level view; normalized below into the shared search shape. */
export type FinalQuizSearchParams = z.infer<typeof finalQuizSearchQuerySchema>;

/** Collapsed view of Next.js searchParams values (first value wins). */
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses raw Next.js search params into the normalized question-search
 * query consumed by searchBankQuestions (the fq/fqpage URL names map to
 * the shared qq/qpage field names). Always succeeds: malformed input
 * falls back to page 1 with no query.
 */
export function parseFinalQuizSearchParams(
  searchParams: SearchParamsRecord,
): LessonQuizSearchQuery {
  const parsed = finalQuizSearchQuerySchema.safeParse({
    fq: firstValue(searchParams.fq),
    fqpage: firstValue(searchParams.fqpage),
  });

  if (!parsed.success) {
    return {};
  }

  return {
    qq: parsed.data.fq,
    qpage: parsed.data.fqpage,
  };
}
