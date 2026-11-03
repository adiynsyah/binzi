// Service-thrown field errors (card S1-01, revision 3 Nov).
//
// Every input error leaves the service as a ZodError with a custom issue on
// the offending field's path, so toErrorResponse() gives it the exact same
// 400 VALIDATION_ERROR + fields shape as a schema failure — one response
// contract for every form. ConflictError (409) stays reserved for version
// conflicts (S1-04). Module-internal (see src/modules/README.md).
import { ZodError } from "zod";

/** A 400-carrying field error: path ["slug"] / ["title"] + message. */
export function courseFieldError(
  path: "slug" | "title",
  message: string,
): ZodError {
  return new ZodError([{ code: "custom", path: [path], message }]);
}

/** Copy is agent-proposed (card S1-01, PR). */
export const SLUG_TAKEN_MESSAGE = (slug: string): string =>
  `Slug “${slug}” sudah dipakai kursus lain — ketik slug yang berbeda.`;

/** 21f copy verbatim, with the comparison course's title interpolated. */
export const SIMILAR_TITLE_MESSAGE = (otherTitle: string): string =>
  `Judul terlalu mirip dengan kursus “${otherTitle}”. Tambahkan pembeda — mis. trimesternya.`;
