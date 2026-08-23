import { z } from "zod";

/**
 * Lesson Create validation (TASK 025, CMS Spec §8, Blueprint §14 "Zod
 * at external boundaries" — server-action form data is one).
 *
 * Field contract per CMS §8 "Create Lesson": Title required,
 * Description optional. Unlike the Course metadata schema (TASK 023),
 * which serves both Create and Edit, this schema is create-only: the
 * Lesson Editor metadata edit belongs to a later task, and lesson
 * fields are intentionally not shared with it yet.
 *
 * Deliberately NOT part of the schema, ever:
 * - `slug` — lessons.slug is NOT NULL with UNIQUE(course_id, slug) in
 *   the database, but CMS §8 does not make it a form field: like the
 *   Course slug (CMS §6, TASK 023), it is system-generated from the
 *   title inside the mutation, unique within the course.
 * - `status` / `publishedAt` — creation forces DRAFT (CMS §8 "A new
 *   Lesson starts as Draft"); the Lesson publish workflow belongs to
 *   a later task, not TASK 025.
 * - `sortOrder` — server-owned. The initial position is derived inside
 *   the mutation (BR §3.2 explicit 1..N ordering, persisted
 *   server-side); reordering is TASK 026 and is not accepted from the
 *   client here.
 * - `id` / `courseId` / `createdAt` / `updatedAt` — database- and
 *   route-owned. The course binding comes from the route context via
 *   the server page (never a hidden field), and timestamps are
 *   database defaults.
 *
 * Description is the single optional field: absent or whitespace-only
 * becomes NULL (column: text NULL). No maximum is imposed, matching
 * the established Course description convention (TASK 023) — the
 * column is unbounded `text` and the CMS spec states no limit.
 */

export const lessonCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul pelajaran wajib diisi.")
    .max(200, "Judul pelajaran maksimal 200 karakter."),
  description: z.preprocess(
    (value) => {
      // Optional field: absent or whitespace-only becomes NULL.
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().nullable(),
  ),
});

export type LessonCreateInput = z.infer<typeof lessonCreateSchema>;

export type LessonCreateField = "title" | "description";

export type LessonCreateFieldErrors = Partial<
  Record<LessonCreateField, string>
>;

/**
 * State returned by the create-lesson server action and consumed by
 * the form via `useActionState`. Success never returns a state — the
 * action redirects back to the Course Builder (TASK 024), where the
 * new draft lesson appears at the end of the lesson list.
 */
export type LessonCreateState =
  | { status: "idle" }
  | {
      status: "error";
      /** Per-field validation messages. */
      errors?: LessonCreateFieldErrors;
      /** Form-level message (auth, permission, course state, storage). */
      message?: string;
    };

export const initialLessonCreateState: LessonCreateState = {
  status: "idle",
};
