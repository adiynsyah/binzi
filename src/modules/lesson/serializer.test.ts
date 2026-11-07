// Unit tests for the lesson serializers (cards S1-02, S1-04). Type-only db
// imports and the pure @/lib/content-doc keep this runnable without
// DATABASE_URL.
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_DOC } from "@/lib/content-doc";

import {
  contentAuditSummary,
  toCreatedLessonDTO,
  toLessonEditorDTO,
  toLessonOutlineItemDTO,
  toUpdatedLessonContentDTO,
  type CreatedLessonRow,
  type LessonEditorCourseRow,
  type LessonEditorLessonRow,
  type LessonOutlineRow,
} from "./serializer";

const FILLED_DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Ada isi." }],
    },
  ],
} as const;

function outlineRow(
  overrides: Partial<LessonOutlineRow> = {},
): LessonOutlineRow {
  return {
    id: "l-1",
    title: "Materi satu",
    orderIndex: 1,
    content: FILLED_DOC,
    videoStatus: "READY",
    videoDurationSeconds: 252,
    isFreePreview: true,
    quizQuestionCount: 10,
    ...overrides,
  };
}

describe("toLessonOutlineItemDTO", () => {
  it("maps the allowlist — the TipTap content never crosses", () => {
    const dto = toLessonOutlineItemDTO(outlineRow());
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "title",
        "orderIndex",
        "isContentEmpty",
        "videoReady",
        "videoDurationSeconds",
        "quizQuestionCount",
        "isFreePreview",
      ].sort(),
    );
    expect(dto.isContentEmpty).toBe(false);
    expect(dto.videoReady).toBe(true);
    expect(dto.videoDurationSeconds).toBe(252);
  });

  it("EMPTY_DOC and whitespace-only text count as empty content", () => {
    expect(toLessonOutlineItemDTO(outlineRow({ content: EMPTY_DOC })).isContentEmpty).toBe(
      true,
    );
    expect(
      toLessonOutlineItemDTO(
        outlineRow({
          content: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "   \n  " }] },
            ],
          },
        }),
      ).isContentEmpty,
    ).toBe(true);
  });

  it("non-READY video statuses render as not ready (21a markers)", () => {
    for (const videoStatus of ["UPLOADING", "FAILED", "NONE"] as const) {
      const dto = toLessonOutlineItemDTO(outlineRow({ videoStatus }));
      expect(dto.videoReady).toBe(false);
    }
  });
});

describe("toCreatedLessonDTO", () => {
  const row: CreatedLessonRow = {
    id: "l-2",
    courseId: "c-1",
    title: "Materi baru",
    slug: "materi-baru",
    orderIndex: 2,
    quizId: "q-1",
    isFreePreview: false,
  };

  it("maps the 201/audit allowlist — no content key", () => {
    const dto = toCreatedLessonDTO(row);
    expect(dto).toEqual({
      id: "l-2",
      courseId: "c-1",
      title: "Materi baru",
      slug: "materi-baru",
      orderIndex: 2,
      quizId: "q-1",
      isFreePreview: false,
    });
  });

  it("throws on a lesson without its quiz instead of leaking a null", () => {
    expect(() => toCreatedLessonDTO({ ...row, quizId: null })).toThrow(
      /without its LESSON quiz/,
    );
  });
});

describe("toUpdatedLessonContentDTO & contentAuditSummary (card S1-04)", () => {
  it("answers id/updatedAt/isContentEmpty — never the document", () => {
    const dto = toUpdatedLessonContentDTO({
      id: "l-1",
      content: FILLED_DOC,
      updatedAt: new Date("2026-11-07T02:04:00.000Z"),
    });
    expect(dto).toEqual({
      id: "l-1",
      updatedAt: "2026-11-07T02:04:00.000Z",
      isContentEmpty: false,
    });
  });

  it("audit summaries carry emptiness only", () => {
    expect(contentAuditSummary(FILLED_DOC)).toEqual({ isContentEmpty: false });
    expect(contentAuditSummary(EMPTY_DOC)).toEqual({ isContentEmpty: true });
    expect(contentAuditSummary(null)).toEqual({ isContentEmpty: true });
  });
});

describe("toLessonEditorDTO (card S1-04)", () => {
  const course: LessonEditorCourseRow = {
    id: "c-1",
    title: "Dasar Gizi Ibu Hamil",
    status: "DRAFT",
  };

  function lessonRow(
    overrides: Partial<LessonEditorLessonRow> = {},
  ): LessonEditorLessonRow {
    return {
      id: "l-1",
      title: "Materi satu",
      orderIndex: 1,
      content: FILLED_DOC,
      ...overrides,
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps the page DTO: course id/title/status + the validated lesson", () => {
    const dto = toLessonEditorDTO(course, lessonRow());
    expect(dto).toEqual({
      course: { id: "c-1", title: "Dasar Gizi Ibu Hamil", status: "DRAFT" },
      lesson: {
        id: "l-1",
        title: "Materi satu",
        orderIndex: 1,
        content: FILLED_DOC,
      },
    });
  });

  it("null content (a lesson never written) opens with EMPTY_DOC", () => {
    const dto = toLessonEditorDTO(course, lessonRow({ content: null }));
    expect(dto.lesson.content).toEqual(EMPTY_DOC);
  });

  it("a stored document that fails the validator comes back null, logged with codes + paths only", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dto = toLessonEditorDTO(course, {
      id: "l-1",
      title: "Materi rusak",
      orderIndex: 2,
      content: { type: "doc", content: [{ type: "iframe" }] },
    });

    expect(dto.lesson).toEqual({
      id: "l-1",
      title: "Materi rusak",
      orderIndex: 2,
      content: null,
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0]?.[1] as unknown;
    expect(logged).toEqual([{ code: "FORBIDDEN_EMBED", path: ["content", 0, "type"] }]);
  });
});
