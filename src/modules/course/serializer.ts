// Explicit serialization for the course module (PRD §12.6, V-01/V-05 note).
//
// Module-internal: consumers outside the module get DTO types re-exported
// from service.ts. Rules:
// - One DTO per audience: the CMS list (21e) and the CMS builder (21g).
// - JSON-safe: dates leave the module as ISO 8601 strings (null stays null).
// - Every function builds a fresh object from an explicit allowlist, so a
//   column not listed (reviewerId, seoTitle, createdBy, …) can never leak
//   even if a future query starts selecting it.
//
// Type-only db imports: serializer tests run without DATABASE_URL.
import type { courses } from "@/db/schema";
import { isDocEmpty } from "@/lib/content-doc";

/** Owner display name: users.name trimmed, falling back to the email. */
function ownerDisplayName(name: string, email: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : email;
}

export type CourseListItemRow = Pick<
  typeof courses.$inferSelect,
  | "id"
  | "title"
  | "slug"
  | "level"
  | "status"
  | "enrollmentCount"
  | "updatedAt"
> & {
  ownerName: string;
  ownerEmail: string;
  lessonCount: number;
  finalQuizQuestionCount: number;
};

export type CmsCourseListItemDTO = {
  id: string;
  title: string;
  slug: string;
  level: CourseListItemRow["level"];
  status: CourseListItemRow["status"];
  lessonCount: number;
  finalQuizQuestionCount: number;
  enrollmentCount: number;
  /** Creator display name — labeled "penggarap" in the UI. */
  ownerName: string;
  updatedAt: string;
};

/**
 * Totals per status across ALL courses (21e tab badges). Never affected by
 * the active tab or search. Lives here — not in queries.ts — so the client
 * list component can import it (queries is server-only).
 */
export type CourseStatusCounts = {
  total: number;
  DRAFT: number;
  IN_REVIEW: number;
  PUBLISHED: number;
  ARCHIVED: number;
};

export function toCmsCourseListItemDTO(
  row: CourseListItemRow,
): CmsCourseListItemDTO {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    level: row.level,
    status: row.status,
    lessonCount: row.lessonCount,
    finalQuizQuestionCount: row.finalQuizQuestionCount,
    enrollmentCount: row.enrollmentCount,
    ownerName: ownerDisplayName(row.ownerName, row.ownerEmail),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CourseDetailRow = Pick<
  typeof courses.$inferSelect,
  | "id"
  | "title"
  | "slug"
  | "summary"
  | "description"
  | "thumbnailUrl"
  | "level"
  | "status"
  | "estimatedMinutes"
  | "publishedAt"
  | "finalQuizId"
  | "enrollmentCount"
  | "updatedAt"
> & {
  ownerName: string;
  ownerEmail: string;
  finalQuizQuestionCount: number;
};

export type CmsCourseDetailDTO = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  /** TipTap document, editable from S1-04; null while the course is new. */
  description: unknown;
  thumbnailUrl: string | null;
  level: CourseDetailRow["level"];
  status: CourseDetailRow["status"];
  estimatedMinutes: number | null;
  publishedAt: string | null;
  enrollmentCount: number;
  ownerName: string;
  updatedAt: string;
  finalQuiz: { id: string; questionCount: number } | null;
};

export function toCmsCourseDetailDTO(row: CourseDetailRow): CmsCourseDetailDTO {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl,
    level: row.level,
    status: row.status,
    estimatedMinutes: row.estimatedMinutes,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    enrollmentCount: row.enrollmentCount,
    ownerName: ownerDisplayName(row.ownerName, row.ownerEmail),
    updatedAt: row.updatedAt.toISOString(),
    finalQuiz:
      row.finalQuizId === null
        ? null
        : {
            id: row.finalQuizId,
            questionCount: row.finalQuizQuestionCount,
          },
  };
}

// ----------------------------------------------------------- builder (S1-02)

export type CourseBuilderRow = Pick<
  typeof courses.$inferSelect,
  | "id"
  | "title"
  | "slug"
  | "summary"
  | "description"
  | "level"
  | "status"
  | "isSequential"
  | "updatedAt"
  | "finalQuizId"
> & {
  ownerName: string;
  ownerEmail: string;
  finalQuizQuestionCount: number;
  /** For the 21a "n soal · d menit · …" line once the quiz has questions. */
  finalQuizDurationMinutes: number | null;
};

/**
 * The builder/settings audience (card S1-02, review addition 2a): the
 * builder PAGE, the PATCH response and the course.update audit before/after
 * all use this DTO. Deliberately a NEW DTO, not a widened
 * CmsCourseDetailDTO: the builder never edits the description here (S1-04
 * owns it), so the TipTap document must not ride along — through client
 * props it would land in the RSC payload. Only the computed
 * isDescriptionEmpty crosses. isSequential must be here too, or a
 * sequential-only PATCH would audit before === after.
 */
export type CmsCourseBuilderDTO = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  level: CourseBuilderRow["level"];
  status: CourseBuilderRow["status"];
  isSequential: boolean;
  isDescriptionEmpty: boolean;
  ownerName: string;
  updatedAt: string;
  finalQuiz: {
    id: string;
    questionCount: number;
    durationMinutes: number;
  } | null;
};

export function toCmsCourseBuilderDTO(
  row: CourseBuilderRow,
): CmsCourseBuilderDTO {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    level: row.level,
    status: row.status,
    isSequential: row.isSequential,
    isDescriptionEmpty: isDocEmpty(row.description),
    ownerName: ownerDisplayName(row.ownerName, row.ownerEmail),
    updatedAt: row.updatedAt.toISOString(),
    finalQuiz:
      row.finalQuizId === null || row.finalQuizDurationMinutes === null
        ? null
        : {
            id: row.finalQuizId,
            questionCount: row.finalQuizQuestionCount,
            durationMinutes: row.finalQuizDurationMinutes,
          },
  };
}
