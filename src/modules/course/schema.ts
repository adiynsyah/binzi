// Zod input contracts for the course module (card S1-01).
//
// This file MAY be imported from outside the module — including client
// forms: it is the shared input contract. Keep it pure Zod with no server
// imports (no "server-only", no db) so it stays safe in a client bundle.
//
// strictObject everywhere: payloads carrying keys the contract does not know
// are rejected instead of silently stripped.
import { z } from "zod";

export const COURSE_TITLE_MAX = 80;
export const COURSE_SLUG_MAX = 80;
export const COURSE_SUMMARY_MAX = 160;

// Keep in sync with courseLevelEnum (src/db/schema/course.ts); spelled out
// here so the contract stays importable from a client bundle.
export const COURSE_LEVELS = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

/** UI labels (PRD §6.2 CRS-01; three values, design 21f drew two). */
export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

// Keep in sync with contentStatusEnum (src/db/schema/course.ts).
export const CONTENT_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * Slugs that collide with static routes of the learn area (STATUS.md) are
 * rejected here — in the shared schema — so the client form and the server
 * apply the exact same rule. Copy is agent-proposed (card S1-01, PR).
 */
export const FORBIDDEN_COURSE_SLUGS: readonly string[] = [
  "kursus-saya",
  "nilai",
];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Title → slug suggestion (21f: filled automatically, editable via "Ubah").
 * NFD-normalize and drop diacritics first, everything outside a–z0–9 becomes
 * "-", runs collapse, edges are trimmed, the result is cut to the max length
 * and trailing "-" produced by that cut is trimmed again. A title made only
 * of punctuation yields "" (the schema then demands a manual slug).
 */
export function slugifyCourseSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, COURSE_SLUG_MAX)
    .replace(/-+$/g, "");
}

export const createCourseInput = z
  .strictObject({
    title: z
      .string()
      .trim()
      .min(1, "Judul kursus wajib diisi.")
      .max(COURSE_TITLE_MAX, `Judul kursus maksimal ${COURSE_TITLE_MAX} karakter.`),
    slug: z
      .string()
      .trim()
      .min(1, "Slug wajib diisi — ubah judul atau ketik manual lewat “Ubah”.")
      .max(COURSE_SLUG_MAX, `Slug maksimal ${COURSE_SLUG_MAX} karakter.`)
      .regex(SLUG_PATTERN, "Slug hanya boleh huruf kecil, angka, dan tanda hubung."),
    level: z.enum(COURSE_LEVELS),
    summary: z
      .string()
      .trim()
      .min(1, "Ringkasan wajib diisi — tanpa ini kartu katalog kosong.")
      .max(
        COURSE_SUMMARY_MAX,
        `Ringkasan maksimal ${COURSE_SUMMARY_MAX} karakter.`,
      ),
  })
  .superRefine((input, ctx) => {
    // Runs after the per-field chain above, so the slug is well-formed.
    if (FORBIDDEN_COURSE_SLUGS.includes(input.slug)) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: `Slug “${input.slug}” dipakai halaman lain — ketik slug yang berbeda.`,
      });
    }
  });

export type CreateCourseInput = z.infer<typeof createCourseInput>;

/**
 * List contract: filter by status, search by title (1–80 chars after
 * trimming; an empty query means "no filter"). The sort ("terakhir diubah")
 * is a server constant — clients cannot choose it (no pagination in MVP).
 */
export const listCoursesInput = z.strictObject({
  status: z.enum(CONTENT_STATUSES).optional(),
  q: z
    .string()
    .trim()
    .max(80, "Pencarian maksimal 80 karakter.")
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type ListCoursesInput = z.infer<typeof listCoursesInput>;

export const getCourseDetailInput = z.strictObject({
  courseId: z.uuid(),
});

export type GetCourseDetailInput = z.infer<typeof getCourseDetailInput>;
