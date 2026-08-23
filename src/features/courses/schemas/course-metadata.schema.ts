import { z } from "zod";

import { courseDifficulty } from "@/db/schema/enums";

/**
 * Course metadata validation (TASK 023, CMS Spec §6/§7, Blueprint §14
 * "Zod at external boundaries" — server-action form data is one).
 *
 * One schema serves BOTH Create and Edit because the approved Course
 * field sets are identical for both operations (unlike Content, where
 * TASK 018/019 needed separate schemas because slug semantics differ):
 * Title, Description, Thumbnail URL, Difficulty, Estimated Duration.
 *
 * Deliberately NOT part of the schema, ever:
 * - `slug` — system-generated from the title at creation only (CMS §6
 *   "Automatically generated: Slug"); the mutation derives it and it is
 *   immutable afterwards, so there is no client slug input to validate.
 * - `status` / `publishedAt` — creation forces DRAFT (CMS §6 "A newly
 *   created Course is always Draft") and saving never transitions
 *   status (Business Rules §22 "Publishing is always explicit"; the
 *   Course publish workflow belongs to a later task, not TASK 023).
 * - `id` / `createdAt` / `updatedAt` — database-owned.
 *
 * Required/optional split follows CMS §6 exactly: Title, Description,
 * Difficulty, and Estimated Duration are required fields; Thumbnail is
 * the single optional field. Estimated Duration is therefore validated
 * as a required non-negative integer (column: INTEGER NULL, minutes —
 * the DB column stays nullable, the CMS form requires a value).
 */

/** Postgres INTEGER (int4) upper bound — protects the column from overflow. */
const MAX_INT4 = 2_147_483_647;

/** Same http/https rule as the established URL conventions (TASK 017/020). */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const courseMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  description: z
    .string()
    .trim()
    .min(1, "Deskripsi wajib diisi."),
  thumbnailUrl: z.preprocess(
    (value) => {
      // Optional field: absent or whitespace-only becomes NULL.
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z
      .string()
      .max(2048, "URL thumbnail maksimal 2048 karakter.")
      .refine(
        isHttpUrl,
        "URL thumbnail harus berupa URL http/https yang valid.",
      )
      .nullable(),
  ),
  difficulty: z.enum(courseDifficulty.enumValues, {
    error: "Tingkat kesulitan tidak valid.",
  }),
  estimatedDuration: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    // CMS §6 lists Estimated Duration under "Required fields".
    z
      .string({ error: "Durasi estimasi wajib diisi." })
      .refine(
        (value) => /^-?\d+$/.test(value),
        "Durasi estimasi harus berupa angka bulat (menit).",
      )
      .refine(
        (value) => Number(value) >= 0,
        "Durasi estimasi tidak boleh negatif.",
      )
      .refine(
        (value) => Number(value) <= MAX_INT4,
        "Durasi estimasi terlalu besar.",
      )
      .transform(Number),
  ),
});

export type CourseMetadataInput = z.infer<typeof courseMetadataSchema>;

export type CourseMetadataField =
  | "title"
  | "description"
  | "thumbnailUrl"
  | "difficulty"
  | "estimatedDuration";

export type CourseMetadataFieldErrors = Partial<
  Record<CourseMetadataField, string>
>;

/**
 * State returned by the create/edit server actions and consumed by the
 * form via `useActionState`. Success never returns a state — both
 * actions redirect to the Course List (TASK 018/019 pattern; the new
 * or edited row sorts to the top by updatedAt DESC, TASK 022).
 */
export type CourseMetadataState =
  | { status: "idle" }
  | {
      status: "error";
      /** Per-field validation messages. */
      errors?: CourseMetadataFieldErrors;
      /** Form-level message (auth, permission, missing course, storage). */
      message?: string;
    };

export const initialCourseMetadataState: CourseMetadataState = {
  status: "idle",
};

/** Editable course shape handed to the form (from getCourseById). */
export type EditableCourse = {
  id: string;
  title: string;
  /** Read-only display: system-generated, immutable after creation. */
  slug: string;
  description: string;
  thumbnailUrl: string | null;
  difficulty: (typeof courseDifficulty.enumValues)[number];
  estimatedDuration: number | null;
  status: "DRAFT" | "PUBLISHED";
};
