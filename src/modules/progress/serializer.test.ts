// Serializer tests (card S5-01 §1): the badge table (PRG-06) and the
// action rule, row by row, plus the allowlist proof — only DTO keys leave
// the module. Runs without a database (type-only db imports).
import { describe, expect, it } from "vitest";

import {
  lessonHref,
  toEnrolledCourseDTO,
  toLearnerCourseDTO,
  type AvailableRow,
  type EnrolledRow,
} from "./serializer";

const LESSON_A = "materi-pertama";
const LESSON_Z = "materi-terakhir";

function enrolledRow(
  overrides: Partial<EnrolledRow> = {},
): EnrolledRow {
  return {
    id: "6f38a3b3-1111-4111-8111-111111111111",
    slug: "gizi-seimbang",
    title: "Gizi Seimbang",
    level: "BEGINNER",
    enrollmentStatus: "IN_PROGRESS",
    lastLessonId: null,
    lastLessonSlug: null,
    lessonCount: 6,
    completedLessonCount: 0,
    firstLessonSlug: LESSON_A,
    ...overrides,
  };
}

function availableRow(
  overrides: Partial<AvailableRow> = {},
): AvailableRow {
  return {
    id: "6f38a3b3-2222-4222-8222-222222222222",
    slug: "mpasi-pertama",
    title: "MPASI Pertama",
    level: "INTERMEDIATE",
    summary: null,
    estimatedMinutes: 28,
    lessonCount: 7,
    firstLessonSlug: LESSON_A,
    ...overrides,
  };
}

describe("lessonHref", () => {
  it("builds /belajar/{courseSlug}/{lessonSlug} (the one href builder)", () => {
    expect(lessonHref("gizi-seimbang", LESSON_A)).toBe(
      `/belajar/gizi-seimbang/${LESSON_A}`,
    );
  });
});

describe("badge (PRG-06)", () => {
  it("PASSED → lulus, regardless of last lesson or completions", () => {
    expect(
      toEnrolledCourseDTO(
        enrolledRow({
          enrollmentStatus: "PASSED",
          lastLessonId: null,
          completedLessonCount: 0,
        }),
      ).badge,
    ).toBe("lulus");
    expect(
      toEnrolledCourseDTO(
        enrolledRow({
          enrollmentStatus: "PASSED",
          lastLessonId: "0d5e6f7a-3333-4333-8333-333333333333",
          completedLessonCount: 6,
        }),
      ).badge,
    ).toBe("lulus");
  });

  it("COMPLETED → selesai (lulus replaces it only for PASSED)", () => {
    expect(
      toEnrolledCourseDTO(enrolledRow({ enrollmentStatus: "COMPLETED" }))
        .badge,
    ).toBe("selesai");
  });

  it("IN_PROGRESS + lastLessonId NULL + 0 completed → belum-dimulai", () => {
    expect(
      toEnrolledCourseDTO(
        enrolledRow({ lastLessonId: null, completedLessonCount: 0 }),
      ).badge,
    ).toBe("belum-dimulai");
  });

  it("IN_PROGRESS + lastLessonId set (nothing completed yet) → sedang-berjalan", () => {
    expect(
      toEnrolledCourseDTO(
        enrolledRow({
          lastLessonId: "0d5e6f7a-3333-4333-8333-333333333333",
          completedLessonCount: 0,
        }),
      ).badge,
    ).toBe("sedang-berjalan");
  });

  it("IN_PROGRESS + a completed lesson (no last lesson) → sedang-berjalan", () => {
    expect(
      toEnrolledCourseDTO(
        enrolledRow({ lastLessonId: null, completedLessonCount: 1 }),
      ).badge,
    ).toBe("sedang-berjalan");
  });
});

describe("action", () => {
  it("lastLessonSlug set → lanjutkan to that lesson", () => {
    const dto = toEnrolledCourseDTO(
      enrolledRow({
        lastLessonId: "0d5e6f7a-3333-4333-8333-333333333333",
        lastLessonSlug: LESSON_Z,
      }),
    );
    expect(dto.action).toEqual({
      kind: "lanjutkan",
      href: `/belajar/gizi-seimbang/${LESSON_Z}`,
    });
  });

  it("lastLessonSlug null → mulai at the first lesson", () => {
    const dto = toEnrolledCourseDTO(enrolledRow());
    expect(dto.action).toEqual({
      kind: "mulai",
      href: `/belajar/gizi-seimbang/${LESSON_A}`,
    });
  });

  it("stale lastLessonId (slug no longer resolves in this course) falls back to mulai", () => {
    const dto = toEnrolledCourseDTO(
      enrolledRow({
        lastLessonId: "0d5e6f7a-3333-4333-8333-333333333333",
        lastLessonSlug: null,
      }),
    );
    expect(dto.action.kind).toBe("mulai");
    expect(dto.action.href).toBe(`/belajar/gizi-seimbang/${LESSON_A}`);
  });
});

describe("toLearnerCourseDTO", () => {
  it("maps the level through COURSE_LEVEL_LABELS and keeps null estimatedMinutes", () => {
    const dto = toLearnerCourseDTO(
      availableRow({ level: "ADVANCED", estimatedMinutes: null }),
    );
    expect(dto.levelLabel).toBe("Lanjutan");
    expect(dto.estimatedMinutes).toBeNull();
    expect(dto.startHref).toBe(`/belajar/mpasi-pertama/${LESSON_A}`);
  });

  it("returns exactly the allowlisted keys", () => {
    const dto = toLearnerCourseDTO(availableRow());
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "slug",
        "title",
        "levelLabel",
        "summary",
        "estimatedMinutes",
        "lessonCount",
        "startHref",
      ].sort(),
    );
  });
});

describe("toEnrolledCourseDTO", () => {
  it("returns exactly the allowlisted keys (no lastLessonId, no enrollmentStatus)", () => {
    const dto = toEnrolledCourseDTO(enrolledRow());
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "slug",
        "title",
        "levelLabel",
        "lessonCount",
        "completedLessonCount",
        "badge",
        "action",
      ].sort(),
    );
  });
});

describe("firstLessonSlug null", () => {
  it("throws instead of building a broken href (programming error)", () => {
    expect(() =>
      toLearnerCourseDTO(availableRow({ firstLessonSlug: null })),
    ).toThrowError("course row without a first lesson slug");
    expect(() =>
      toEnrolledCourseDTO(
        enrolledRow({ firstLessonSlug: null, lastLessonSlug: null }),
      ),
    ).toThrowError("course row without a first lesson slug");
  });
});
