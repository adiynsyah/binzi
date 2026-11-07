// Zod input contracts for the course module (card S1-01).
//
// This file MAY be imported from outside the module — including client
// forms: it is the shared input contract. Keep it pure Zod with no server
// imports (no "server-only", no db) so it stays safe in a client bundle.
//
// strictObject everywhere: payloads carrying keys the contract does not know
// are rejected instead of silently stripped.
import { z } from "zod";

import { contentDocSchema } from "@/lib/content-doc-validator";
import { slugify } from "@/lib/slug";

export const COURSE_TITLE_MAX = 80;
export const COURSE_SLUG_MAX = 80;
export const COURSE_SUMMARY_MAX = 160;

/**
 * Route-param shape check shared by the API routes and the pages (card
 * S1-02): a non-UUID must answer 404, never a 500 from Postgres parsing.
 */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * The rule itself lives in @/lib/slug (shared with the lesson module since
 * card S1-02); only the course max length is decided here.
 */
export function slugifyCourseSlug(title: string): string {
  return slugify(title, COURSE_SLUG_MAX);
}

// One source for the course field rules: createCourseInput (S1-01) and
// updateCourseInput (S1-02) are the SAME rules — "memakai ulang aturan
// isian … satu sumber aturan; tidak ada salinan" (card §2) — so the builder
// panel form and the server apply exactly what the 21f dialog applied.
const courseTitle = z
  .string()
  .trim()
  .min(1, "Judul kursus wajib diisi.")
  .max(COURSE_TITLE_MAX, `Judul kursus maksimal ${COURSE_TITLE_MAX} karakter.`);

const courseSlug = z
  .string()
  .trim()
  .min(1, "Slug wajib diisi — ubah judul atau ketik manual lewat “Ubah”.")
  .max(COURSE_SLUG_MAX, `Slug maksimal ${COURSE_SLUG_MAX} karakter.`)
  .regex(SLUG_PATTERN, "Slug hanya boleh huruf kecil, angka, dan tanda hubung.");

const courseLevel = z.enum(COURSE_LEVELS);

const courseSummary = z
  .string()
  .trim()
  .min(1, "Ringkasan wajib diisi — tanpa ini kartu katalog kosong.")
  .max(COURSE_SUMMARY_MAX, `Ringkasan maksimal ${COURSE_SUMMARY_MAX} karakter.`);

/** Shared superRefine: runs after the per-field chain, so the slug is well-formed. */
function rejectForbiddenSlug(input: { slug: string }, ctx: z.RefinementCtx): void {
  if (FORBIDDEN_COURSE_SLUGS.includes(input.slug)) {
    ctx.addIssue({
      code: "custom",
      path: ["slug"],
      message: `Slug “${input.slug}” dipakai halaman lain — ketik slug yang berbeda.`,
    });
  }
}

export const createCourseInput = z
  .strictObject({
    title: courseTitle,
    slug: courseSlug,
    level: courseLevel,
    summary: courseSummary,
  })
  .superRefine(rejectForbiddenSlug);

export type CreateCourseInput = z.infer<typeof createCourseInput>;

/**
 * Builder settings form (card S1-02 §2): the create rules plus the
 * sequential-materials switch (CRS-08). Client-safe — the settings panel
 * resolves this same schema, so both ends enforce one contract.
 */
export const updateCourseInput = z
  .strictObject({
    title: courseTitle,
    slug: courseSlug,
    level: courseLevel,
    summary: courseSummary,
    isSequential: z.boolean(),
  })
  .superRefine(rejectForbiddenSlug);

export type UpdateCourseInput = z.infer<typeof updateCourseInput>;

/**
 * Save the course description (card S1-04 §3) — a SEPARATE endpoint from
 * PATCH /api/cms/courses/{id}: the five-field settings contract stays
 * untouched and a long document never rides along on every settings save.
 * contentDocSchema parses AND validates the document (CRS-05); its output
 * is what the server stores.
 */
export const updateCourseDescriptionInput = z.strictObject({
  description: contentDocSchema,
});

export type UpdateCourseDescriptionInput = z.infer<
  typeof updateCourseDescriptionInput
>;

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
