// Serializer allowlist tests (cards S1-01, S1-04): prove that ONLY the DTO
// fields leave the module — a raw row carrying sensitive/unlisted columns
// (reviewerId, seoTitle, createdBy, …) cannot leak through, and every Date
// leaves as an ISO string. Runs without DATABASE_URL (type-only db imports).
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_DOC } from "@/lib/content-doc";

import {
  descriptionAuditSummary,
  toCmsCourseDetailDTO,
  toCmsCourseListItemDTO,
  toCourseDescriptionEditorDTO,
  toUpdatedCourseDescriptionDTO,
  type CourseDescriptionEditorRow,
  type CourseDetailRow,
  type CourseListItemRow,
} from "./serializer";

const base = {
  id: "6f38a3b3-1111-4111-8111-111111111111",
  title: "Gizi Seimbang",
  slug: "gizi-seimbang",
  level: "BEGINNER" as const,
  status: "DRAFT" as const,
  enrollmentCount: 0,
  updatedAt: new Date("2026-11-03T08:00:00.000Z"),
};

const listRow = {
  ...base,
  ownerName: "  Andi Prasetyo  ",
  ownerEmail: "andi@example.com",
  lessonCount: 3,
  finalQuizQuestionCount: 12,
  // Unlisted columns a future query might start selecting.
  createdBy: "user-1",
  reviewerId: null,
  seoTitle: null,
} as unknown as CourseListItemRow;

describe("toCmsCourseListItemDTO", () => {
  it("returns exactly the allowlisted keys", () => {
    const dto = toCmsCourseListItemDTO(listRow);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "title",
        "slug",
        "level",
        "status",
        "lessonCount",
        "finalQuizQuestionCount",
        "enrollmentCount",
        "ownerName",
        "updatedAt",
      ].sort(),
    );
    expect(dto).not.toHaveProperty("createdBy");
    expect(dto).not.toHaveProperty("reviewerId");
  });

  it("serializes dates as ISO strings and trims the owner name", () => {
    const dto = toCmsCourseListItemDTO(listRow);
    expect(dto.updatedAt).toBe("2026-11-03T08:00:00.000Z");
    expect(dto.ownerName).toBe("Andi Prasetyo");
  });

  it("falls back to the email when the owner name is blank", () => {
    const dto = toCmsCourseListItemDTO({
      ...listRow,
      ownerName: "   ",
      ownerEmail: "owner@example.com",
    });
    expect(dto.ownerName).toBe("owner@example.com");
  });
});

const detailRow = {
  ...base,
  summary: "Ringkasan.",
  description: null,
  thumbnailUrl: null,
  estimatedMinutes: null,
  publishedAt: null,
  finalQuizId: "0f38a3b3-2222-4222-8222-222222222222",
  ownerName: "Sari",
  ownerEmail: "sari@example.com",
  finalQuizQuestionCount: 0,
  createdBy: "user-1",
  seoDescription: null,
  updatedBy: "user-1",
} as unknown as CourseDetailRow;

describe("toCmsCourseDetailDTO", () => {
  it("returns exactly the allowlisted keys", () => {
    const dto = toCmsCourseDetailDTO(detailRow);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "title",
        "slug",
        "summary",
        "description",
        "thumbnailUrl",
        "level",
        "status",
        "estimatedMinutes",
        "publishedAt",
        "enrollmentCount",
        "ownerName",
        "updatedAt",
        "finalQuiz",
      ].sort(),
    );
    expect(dto).not.toHaveProperty("createdBy");
  });

  it("nests the final quiz with its question count", () => {
    const dto = toCmsCourseDetailDTO(detailRow);
    expect(dto.finalQuiz).toEqual({
      id: "0f38a3b3-2222-4222-8222-222222222222",
      questionCount: 0,
    });
  });

  it("keeps null dates null and null quiz null", () => {
    const dto = toCmsCourseDetailDTO({
      ...detailRow,
      publishedAt: new Date("2026-11-03T09:30:00.000Z"),
      finalQuizId: null,
    });
    expect(dto.publishedAt).toBe("2026-11-03T09:30:00.000Z");

    const withoutQuiz = toCmsCourseDetailDTO({ ...detailRow, finalQuizId: null });
    expect(withoutQuiz.finalQuiz).toBeNull();
  });
});

const FILLED_DESCRIPTION = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Untuk siapa." }] },
  ],
} as const;

describe("toUpdatedCourseDescriptionDTO & descriptionAuditSummary (card S1-04)", () => {
  it("answers id/updatedAt/isDescriptionEmpty — never the document", () => {
    const dto = toUpdatedCourseDescriptionDTO({
      id: base.id,
      description: FILLED_DESCRIPTION,
      updatedAt: new Date("2026-11-07T02:04:00.000Z"),
    });
    expect(dto).toEqual({
      id: base.id,
      updatedAt: "2026-11-07T02:04:00.000Z",
      isDescriptionEmpty: false,
    });
  });

  it("audit summaries carry emptiness only", () => {
    expect(descriptionAuditSummary(FILLED_DESCRIPTION)).toEqual({
      isDescriptionEmpty: false,
    });
    expect(descriptionAuditSummary(null)).toEqual({ isDescriptionEmpty: true });
  });
});

describe("toCourseDescriptionEditorDTO (card S1-04)", () => {
  function editorRow(
    overrides: Partial<CourseDescriptionEditorRow> = {},
  ): CourseDescriptionEditorRow {
    return {
      id: base.id,
      title: "Gizi Seimbang",
      status: "DRAFT",
      description: FILLED_DESCRIPTION,
      ...overrides,
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps a stored description through the validator", () => {
    const dto = toCourseDescriptionEditorDTO(editorRow());
    expect(dto).toEqual({
      id: base.id,
      title: "Gizi Seimbang",
      status: "DRAFT",
      description: FILLED_DESCRIPTION,
    });
  });

  it("maps a null description ('belum diisi') to EMPTY_DOC", () => {
    const dto = toCourseDescriptionEditorDTO(editorRow({ description: null }));
    expect(dto.description).toEqual(EMPTY_DOC);
  });

  it("a stored document that fails the validator comes back null, logged with codes + paths only", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dto = toCourseDescriptionEditorDTO(
      editorRow({ description: { type: "doc", content: [{ type: "iframe" }] } }),
    );

    expect(dto.description).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0]?.[1] as unknown;
    expect(logged).toEqual([{ code: "FORBIDDEN_EMBED", path: ["content", 0, "type"] }]);
  });
});
