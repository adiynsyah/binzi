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
import { EMPTY_DOC, isDocEmpty, type ContentDoc } from "@/lib/content-doc";
import { validateContentDoc } from "@/lib/content-doc-validator";

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

// -------------------------------------------- review + queue (card S1-08)

/** Review facts riding beside the builder course (card §3). */
export type CourseReviewDTO = {
  reviewerName: string;
  /** ISO 8601 — when the course was sent for approval (reviewed_at). */
  reviewedAt: string;
};

/**
 * null while the course has no reviewer yet (DRAFT, or a legacy IN_REVIEW
 * row). Submit stamps reviewer_id and reviewed_at together, so both are
 * either present or the review reads as not recorded. The name follows the
 * ownerDisplayName pattern: trimmed name, or the email when blank.
 */
export function toCourseReviewDTO(row: {
  reviewerId: string | null;
  reviewerName: string | null;
  reviewerEmail: string | null;
  reviewedAt: Date | null;
}): CourseReviewDTO | null {
  if (row.reviewerId === null || row.reviewedAt === null) {
    return null;
  }
  return {
    reviewerName: ownerDisplayName(row.reviewerName ?? "", row.reviewerEmail ?? ""),
    reviewedAt: row.reviewedAt.toISOString(),
  };
}

/** What the approval-queue lookup reads (card §6): reviewer via left join. */
export type CourseApprovalQueueRow = {
  id: string;
  title: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
  reviewedAt: Date | null;
};

/**
 * One queue row (card §6). reviewerName stays null when no reviewer is
 * recorded — the queue renders that state explicitly ("PENGGARAP BELUM
 * TERCATAT · —", 19d) instead of hiding the row.
 */
export type CourseApprovalQueueItemDTO = {
  id: string;
  title: string;
  reviewerName: string | null;
  reviewedAt: string | null;
};

export function toCourseApprovalQueueItemDTO(
  row: CourseApprovalQueueRow,
): CourseApprovalQueueItemDTO {
  return {
    id: row.id,
    title: row.title,
    reviewerName:
      row.reviewerName === null && row.reviewerEmail === null
        ? null
        : ownerDisplayName(row.reviewerName ?? "", row.reviewerEmail ?? ""),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

// ------------------------------------------------- description (card S1-04)

/** What the description-save transaction reads and answers (card §3). */
export type CourseDescriptionRow = Pick<
  typeof courses.$inferSelect,
  "id" | "description" | "updatedAt"
>;

/** 200 response of PUT …/description: no document comes back. */
export type UpdatedCourseDescriptionDTO = {
  id: string;
  updatedAt: string;
  isDescriptionEmpty: boolean;
};

export function toUpdatedCourseDescriptionDTO(
  row: CourseDescriptionRow,
): UpdatedCourseDescriptionDTO {
  return {
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
    isDescriptionEmpty: isDocEmpty(row.description),
  };
}

/** Audit summaries (card §3 step 3): emptiness only, never the document. */
export function descriptionAuditSummary(
  description: unknown,
): { isDescriptionEmpty: boolean } {
  return { isDescriptionEmpty: isDocEmpty(description) };
}

/** The description editor page's columns (card §6). */
export type CourseDescriptionEditorRow = Pick<
  typeof courses.$inferSelect,
  "id" | "title" | "status" | "description"
>;

export type CourseDescriptionEditorDTO = {
  id: string;
  title: string;
  status: CourseDescriptionEditorRow["status"];
  /**
   * null in the DB ("belum diisi") maps to EMPTY_DOC so the editor opens
   * with the same blank canvas a new lesson gets. null OUT means the
   * STORED document failed the validator — never expected; the page then
   * answers "Deskripsi ini tidak bisa dibuka editor." (card §6).
   */
  description: ContentDoc | null;
};

export function toCourseDescriptionEditorDTO(
  row: CourseDescriptionEditorRow,
): CourseDescriptionEditorDTO {
  if (row.description === null) {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      description: EMPTY_DOC,
    };
  }
  // Re-validate the stored document (§12.3): codes and paths only in the
  // log, never the document's text.
  const result = validateContentDoc(row.description);
  if (!result.ok) {
    console.error(
      "deskripsi kursus: dokumen tidak lolos validasi",
      result.issues.map((issue) => ({ code: issue.code, path: issue.path })),
    );
    return { id: row.id, title: row.title, status: row.status, description: null };
  }
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    description: result.doc,
  };
}
