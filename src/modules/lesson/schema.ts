// Zod input contracts for the lesson module (card S1-02).
//
// Client-safe by the same rule as the course schema: pure Zod, no server
// imports, so the add-lesson dialog (21h) resolves the identical contract.
import { z } from "zod";

export const LESSON_TITLE_MAX = 80;

/** "Tambah materi" (21h): one field — the content itself is written in the editor (S1-04). */
export const createLessonInput = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, "Judul materi wajib diisi.")
    .max(LESSON_TITLE_MAX, `Judul materi maksimal ${LESSON_TITLE_MAX} karakter.`),
});

export type CreateLessonInput = z.infer<typeof createLessonInput>;

/** Lesson-in-course lookup for the (placeholder) lesson editor page. */
export const getLessonInput = z.strictObject({
  courseId: z.uuid(),
  lessonId: z.uuid(),
});

export type GetLessonInput = z.infer<typeof getLessonInput>;
