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
  toPublicCourseCardDTO,
  toPublicCourseDetailDTO,
  toUpdatedCourseDescriptionDTO,
  type CourseDescriptionEditorRow,
  type CourseDetailRow,
  type CourseListItemRow,
  type PublicCatalogRow,
  type PublicCourseRow,
  type PublicLessonOutlineRow,
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

// ------------------------------------------------------------ card S6-02

const publicCatalogRow = {
  slug: "gizi-seimbang",
  title: "Gizi Seimbang",
  level: "BEGINNER",
  summary: "Ringkasan.",
  estimatedMinutes: 42,
  lessonCount: 8,
  // Unlisted columns a future query might start selecting.
  id: "6f38a3b3-1111-4111-8111-111111111111",
  status: "PUBLISHED",
  enrollmentCount: 3,
  createdBy: "user-1",
  reviewerId: null,
} as unknown as PublicCatalogRow;

describe("toPublicCourseCardDTO (card S6-02)", () => {
  it("returns exactly the allowlisted keys", () => {
    const dto = toPublicCourseCardDTO(publicCatalogRow);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "slug",
        "title",
        "levelLabel",
        "summary",
        "lessonCount",
        "estimatedMinutes",
        "href",
      ].sort(),
    );
    expect(dto).not.toHaveProperty("id");
    expect(dto).not.toHaveProperty("status");
    expect(dto).not.toHaveProperty("enrollmentCount");
    expect(dto).not.toHaveProperty("createdBy");
    expect(dto).not.toHaveProperty("reviewerId");
  });

  it("maps the level label, builds the detail href, keeps nulls null", () => {
    const dto = toPublicCourseCardDTO(publicCatalogRow);
    expect(dto.levelLabel).toBe("Pemula");
    expect(dto.href).toBe("/kursus/gizi-seimbang");

    const sparse = toPublicCourseCardDTO({
      ...publicCatalogRow,
      summary: null,
      estimatedMinutes: null,
    });
    expect(sparse.summary).toBeNull();
    expect(sparse.estimatedMinutes).toBeNull();
  });
});

const publicCourseRow = {
  id: "6f38a3b3-1111-4111-8111-111111111111",
  slug: "gizi-seimbang",
  title: "Gizi Seimbang",
  summary: "Ringkasan.",
  description: FILLED_DESCRIPTION,
  level: "INTERMEDIATE",
  estimatedMinutes: 42,
  seoTitle: null,
  seoDescription: null,
  finalQuizId: "0f38a3b3-2222-4222-8222-222222222222",
  // Unlisted columns a future query might start selecting.
  status: "PUBLISHED",
  thumbnailUrl: null,
  enrollmentCount: 3,
  createdBy: "user-1",
  reviewerId: null,
} as unknown as PublicCourseRow;

function outlineRow(
  overrides: Partial<PublicLessonOutlineRow> = {},
): PublicLessonOutlineRow {
  return {
    title: "Kebutuhan energi & protein",
    videoStatus: "READY",
    videoDurationSeconds: 252,
    ...overrides,
  };
}

describe("toPublicCourseDetailDTO (card S6-02)", () => {
  it("returns exactly the allowlisted keys at the top level", () => {
    const dto = toPublicCourseDetailDTO(publicCourseRow, [
      outlineRow(),
      outlineRow({ title: "Asam folat & zat besi" }),
    ]);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "slug",
        "title",
        "summary",
        "levelLabel",
        "lessonCount",
        "estimatedMinutes",
        "hasFinalQuiz",
        "description",
        "lessons",
        "meta",
      ].sort(),
    );
    expect(dto).not.toHaveProperty("status");
    expect(dto).not.toHaveProperty("enrollmentCount");
    expect(dto).not.toHaveProperty("createdBy");
    expect(dto).not.toHaveProperty("reviewerId");
    expect(dto).not.toHaveProperty("seoTitle");
  });

  it("outline rows carry exactly position, title, durationSeconds", () => {
    const dto = toPublicCourseDetailDTO(publicCourseRow, [
      outlineRow(),
      outlineRow({ title: "Asam folat & zat besi" }),
    ]);
    expect(dto.lessonCount).toBe(2);
    expect(dto.lessons.map((lesson) => lesson.position)).toEqual([1, 2]);
    for (const lesson of dto.lessons) {
      expect(Object.keys(lesson).sort()).toEqual(
        ["position", "title", "durationSeconds"].sort(),
      );
      expect(lesson).not.toHaveProperty("slug");
      expect(lesson).not.toHaveProperty("id");
      expect(lesson).not.toHaveProperty("videoStatus");
      expect(lesson).not.toHaveProperty("quizId");
    }
  });

  it("durationSeconds only for READY video with a duration > 0", () => {
    const dto = toPublicCourseDetailDTO(publicCourseRow, [
      outlineRow({ videoStatus: "READY", videoDurationSeconds: 100 }),
      outlineRow({ videoStatus: "NONE", videoDurationSeconds: 200 }),
      outlineRow({ videoStatus: "READY", videoDurationSeconds: 0 }),
    ]);
    expect(dto.lessons.map((lesson) => lesson.durationSeconds)).toEqual([
      100,
      null,
      null,
    ]);
  });

  it("meta falls back to the title and the summary; hasFinalQuiz follows finalQuizId", () => {
    const dto = toPublicCourseDetailDTO(publicCourseRow, [outlineRow()]);
    expect(dto.meta).toEqual({
      title: "Gizi Seimbang",
      description: "Ringkasan.",
    });
    expect(dto.hasFinalQuiz).toBe(true);

    const withSeo = toPublicCourseDetailDTO(
      {
        ...publicCourseRow,
        seoTitle: "Gizi ibu hamil — panduan praktis",
        seoDescription: "Deskripsi SEO.",
        finalQuizId: null,
      },
      [outlineRow()],
    );
    expect(withSeo.meta).toEqual({
      title: "Gizi ibu hamil — panduan praktis",
      description: "Deskripsi SEO.",
    });
    expect(withSeo.hasFinalQuiz).toBe(false);

    const sparse = toPublicCourseDetailDTO(
      { ...publicCourseRow, seoDescription: null, summary: null },
      [outlineRow()],
    );
    expect(sparse.meta.description).toBeNull();
  });
});
