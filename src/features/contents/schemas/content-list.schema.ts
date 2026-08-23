import { z } from "zod";

import { contentType, publicationStatus } from "@/db/schema/enums";

/**
 * Content List URL query schema (TASK 016, Blueprint §14 "Zod at
 * external boundaries" — URL search params are an external boundary).
 *
 * Enum values are derived from the Drizzle schema enums so the filter
 * vocabulary can never drift from the database definition. Unknown
 * status/type values normalize to "no filter" and invalid pages
 * normalize to 1 — the list always renders predictably.
 */
export const contentListQuerySchema = z.object({
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
  type: z.enum(contentType.enumValues).optional().catch(undefined),
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

export type ContentListQuery = z.infer<typeof contentListQuerySchema>;

/** Collapsed view of Next.js searchParams values (first value wins). */
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses raw Next.js search params into a normalized Content List
 * query. Always succeeds: any malformed input falls back to the
 * unfiltered first page.
 */
export function parseContentListSearchParams(
  searchParams: SearchParamsRecord,
): ContentListQuery {
  const parsed = contentListQuerySchema.safeParse({
    q: firstValue(searchParams.q),
    status: firstValue(searchParams.status),
    type: firstValue(searchParams.type),
    page: firstValue(searchParams.page),
  });

  if (!parsed.success) {
    return {};
  }

  return parsed.data;
}
