// Explicit serialization for the lesson module (PRD §12.6, cards S1-02,
// S1-04).
//
// Module-internal: consumers outside the module get DTO types re-exported
// from service.ts. Audiences and DTOs:
// - the outline row (builder 21a): everything the row markers need and
//   NOTHING else — the TipTap content itself never crosses this boundary,
//   only the computed isContentEmpty;
// - the created lesson (201 response + audit `after`);
// - the content-save response (S1-04): id/updatedAt/isContentEmpty — the
//   document is never echoed back;
// - the editor page (S1-04): the document itself, validated HERE so an
//   unreadable row never opens the editor.
//
// Type-only db imports + the pure @/lib/content-doc: serializer tests run
// without DATABASE_URL.
import type { courses, lessons } from "@/db/schema";
import { isDocEmpty, type ContentDoc } from "@/lib/content-doc";
import { validateContentDoc } from "@/lib/content-doc-validator";

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

// ------------------------------------------------------ content save (S1-04)

/** What the content-save transaction reads and answers (card §2). */
export type LessonContentRow = Pick<
  typeof lessons.$inferSelect,
  "id" | "content" | "updatedAt"
>;

/** 200 response of PATCH …/lessons/{lessonId}: no document comes back. */
export type UpdatedLessonContentDTO = {
  id: string;
  updatedAt: string;
  isContentEmpty: boolean;
};

export function toUpdatedLessonContentDTO(row: LessonContentRow): UpdatedLessonContentDTO {
  return {
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
    isContentEmpty: isDocEmpty(row.content),
  };
}

/** Audit summaries (card §2 step 4): emptiness only, never the document. */
export function contentAuditSummary(content: unknown): { isContentEmpty: boolean } {
  return { isContentEmpty: isDocEmpty(content) };
}

// -------------------------------------------------------- editor page (S1-04)

/** The editor page's course columns (card §5). */
export type LessonEditorCourseRow = Pick<
  typeof courses.$inferSelect,
  "id" | "title" | "status"
>;

/** The editor page's lesson columns (card §5). */
export type LessonEditorLessonRow = Pick<
  typeof lessons.$inferSelect,
  "id" | "title" | "orderIndex" | "content"
>;

export type LessonEditorDTO = {
  course: {
    id: string;
    title: string;
    status: LessonEditorCourseRow["status"];
  };
  lesson: {
    id: string;
    title: string;
    orderIndex: number;
    /**
     * null only when the STORED document fails the validator — never
     * expected; the page answers with "Isi materi ini tidak bisa dibuka
     * editor." instead of opening the editor (card §5).
     */
    content: ContentDoc | null;
  };
};

export function toLessonEditorDTO(
  course: LessonEditorCourseRow,
  lesson: LessonEditorLessonRow,
): LessonEditorDTO {
  // Re-validate the stored document (§12.3 "sanitasi ulang saat render"):
  // codes and paths only in the log, never the document's text.
  const result = validateContentDoc(lesson.content);
  if (!result.ok) {
    console.error(
      "lesson editor: dokumen materi tidak lolos validasi",
      result.issues.map((issue) => ({ code: issue.code, path: issue.path })),
    );
    return {
      course: { id: course.id, title: course.title, status: course.status },
      lesson: { id: lesson.id, title: lesson.title, orderIndex: lesson.orderIndex, content: null },
    };
  }
  return {
    course: { id: course.id, title: course.title, status: course.status },
    lesson: {
      id: lesson.id,
      title: lesson.title,
      orderIndex: lesson.orderIndex,
      content: result.doc,
    },
  };
}
