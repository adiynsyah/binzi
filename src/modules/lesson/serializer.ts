// Explicit serialization for the lesson module (PRD §12.6, card S1-02).
//
// Module-internal: consumers outside the module get DTO types re-exported
// from service.ts. Two audiences, two DTOs:
// - the outline row (builder 21a): everything the row markers need and
//   NOTHING else — the TipTap content itself never crosses this boundary,
//   only the computed isContentEmpty;
// - the created lesson (201 response + audit `after`).
//
// Type-only db imports + the pure @/lib/content-doc: serializer tests run
// without DATABASE_URL.
import type { lessons } from "@/db/schema";
import { isDocEmpty } from "@/lib/content-doc";

export type LessonOutlineRow = Pick<
  typeof lessons.$inferSelect,
  | "id"
  | "title"
  | "orderIndex"
  | "content"
  | "videoStatus"
  | "videoDurationSeconds"
  | "isFreePreview"
> & {
  quizQuestionCount: number;
};

export type LessonOutlineItemDTO = {
  id: string;
  title: string;
  orderIndex: number;
  /** Computed from the TipTap content HERE — the document never leaves. */
  isContentEmpty: boolean;
  /** video_status === "READY" (UPLOADING/FAILED render as "BELUM ADA VIDEO"). */
  videoReady: boolean;
  videoDurationSeconds: number | null;
  quizQuestionCount: number;
  isFreePreview: boolean;
};

export function toLessonOutlineItemDTO(
  row: LessonOutlineRow,
): LessonOutlineItemDTO {
  return {
    id: row.id,
    title: row.title,
    orderIndex: row.orderIndex,
    isContentEmpty: isDocEmpty(row.content),
    videoReady: row.videoStatus === "READY",
    videoDurationSeconds: row.videoDurationSeconds,
    quizQuestionCount: row.quizQuestionCount,
    isFreePreview: row.isFreePreview,
  };
}

export type CreatedLessonRow = Pick<
  typeof lessons.$inferSelect,
  | "id"
  | "courseId"
  | "title"
  | "slug"
  | "orderIndex"
  | "quizId"
  | "isFreePreview"
>;

export type CreatedLessonDTO = {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  orderIndex: number;
  quizId: string;
  isFreePreview: boolean;
};

export function toCreatedLessonDTO(row: CreatedLessonRow): CreatedLessonDTO {
  if (row.quizId === null) {
    // Unreachable via createLessonWithQuiz (the quiz is inserted first in
    // the same transaction) — kept as a hard stop, not a silent null.
    throw new Error("lesson row created without its LESSON quiz");
  }
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    slug: row.slug,
    orderIndex: row.orderIndex,
    quizId: row.quizId,
    isFreePreview: row.isFreePreview,
  };
}

/** The lesson editor placeholder (S1-02) shows only the title. */
export type LessonTitleRow = Pick<typeof lessons.$inferSelect, "id" | "title">;

export function toLessonTitleDTO(row: LessonTitleRow): { id: string; title: string } {
  return { id: row.id, title: row.title };
}
