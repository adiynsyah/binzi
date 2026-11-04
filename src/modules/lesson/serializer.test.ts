// Unit tests for the lesson serializers (card S1-02). Type-only db imports
// and the pure @/lib/content-doc keep this runnable without DATABASE_URL.
import { describe, expect, it } from "vitest";

import { EMPTY_DOC } from "@/lib/content-doc";

import {
  toCreatedLessonDTO,
  toLessonOutlineItemDTO,
  type CreatedLessonRow,
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
