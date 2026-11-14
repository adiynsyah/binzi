// Serializer tests (cards S5-01 §1 + S2-01 §1): the badge table (PRG-06),
// the action rule, row by row, plus the allowlist proof — only DTO keys
// leave the module — and the lesson-page union (item-state priority, next
// forms, percent Number). Runs without a database (type-only db imports).
import { describe, expect, it } from "vitest";

import {
  lessonHref,
  toEnrolledCourseDTO,
  toLearnerCourseDTO,
  toLessonPageDTO,
  type AvailableRow,
  type EnrolledRow,
  type LessonOutlineRow,
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

// ------------------------------------------------------ lesson page (S2-01)

const LESSON_COURSE = {
  id: "course-uuid",
  slug: "gizi-seimbang",
  title: "Gizi Seimbang",
  isSequential: true,
};

/** An outline row per position; `quizAttempted` drives the gate. */
function lessonRow(position: number, overrides: Partial<LessonOutlineRow> = {}) {
  return {
    id: `lesson-${position}`,
    slug: `materi-${position}`,
    title: `Judul materi ${position}`,
    videoStatus: "NONE" as const,
    status: null,
    quizAttempted: null,
    videoLastPositionSeconds: null,
    videoWatchedPercent: null,
    ...overrides,
  };
}

describe("toLessonPageDTO — item states", () => {
  it("priority: kini beats selesai, selesai beats terkunci", () => {
    // Lesson 2 is COMPLETED and is the page target → "kini" wins. Lesson
    // 3 is COMPLETED while the gate re-locks it (quiz 2 not attempted) →
    // "selesai" wins over "terkunci". Lesson 1 COMPLETED → "selesai".
    const outline = [
      lessonRow(1, { quizAttempted: true, status: "COMPLETED" }),
      lessonRow(2, { status: "COMPLETED" }),
      lessonRow(3, { status: "COMPLETED" }),
    ];
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline,
      targetIndex: 1,
      content: null,
    });
    expect(dto.state).toBe("open");
    if (dto.state !== "open") return;
    expect(dto.outline.map((item) => item.state)).toEqual([
      "selesai",
      "kini",
      "selesai",
    ]);
  });

  it("href is null exactly for terkunci items; all hrefs use lessonHref", () => {
    const outline = [
      lessonRow(1, { quizAttempted: true, status: "COMPLETED" }),
      lessonRow(2),
      lessonRow(3),
    ];
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline,
      targetIndex: 1,
      content: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.outline.map((item) => item.state)).toEqual([
      "selesai",
      "kini",
      "terkunci",
    ]);
    for (const item of dto.outline) {
      if (item.state === "terkunci") {
        expect(item.href).toBeNull();
      } else {
        expect(item.href).toBe(
          lessonHref(LESSON_COURSE.slug, `materi-${item.position}`),
        );
      }
    }
  });
});

describe("toLessonPageDTO — page states", () => {
  // Quiz 1 attempted → lesson 2 open; quiz 2 not → lesson 3 locked.
  const threeLessons = [
    lessonRow(1, { quizAttempted: true, status: "COMPLETED" }),
    lessonRow(2),
    lessonRow(3),
  ];

  it("not-enrolled carries no content, no progress, no outline", () => {
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: undefined,
      outline: threeLessons,
      targetIndex: 0,
      content: null,
    });
    expect(dto.state).toBe("not-enrolled");
    expect("content" in dto && dto.content).toBeFalsy();
    expect("progress" in dto).toBe(false);
    expect("outline" in dto).toBe(false);
    expect(dto.course).toEqual({ id: LESSON_COURSE.id, title: LESSON_COURSE.title });
    expect(dto.lesson).toEqual({ title: "Judul materi 1", position: 1 });
  });

  it("locked answers unlock { position, href } and no content/progress", () => {
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline: threeLessons,
      targetIndex: 2,
      content: null,
    });
    expect(dto.state).toBe("locked");
    if (dto.state !== "locked") return;
    // Quiz 1 is done, quiz 2 is the first open unattempted → materi 2.
    expect(dto.unlock).toEqual({
      position: 2,
      href: lessonHref(LESSON_COURSE.slug, "materi-2"),
    });
    expect("content" in dto && dto.content).toBeFalsy();
    expect("progress" in dto).toBe(false);
  });

  it("a locked page always offers an unlock while position 1 exists", () => {
    // Locked means the direct predecessor is unattempted, and position 1
    // is always open — so firstOpenUnattempted can never answer null here
    // (the unlock-null panel copy is the unreachable-data fallback).
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline: [lessonRow(1), lessonRow(2)],
      targetIndex: 1,
      content: null,
    });
    expect(dto.state).toBe("locked");
    if (dto.state !== "locked") return;
    expect(dto.unlock).toEqual({
      position: 1,
      href: lessonHref(LESSON_COURSE.slug, "materi-1"),
    });
  });

  it("open turns the NUMERIC string percent into a number", () => {
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline: [
        lessonRow(1, {
          quizAttempted: true,
          status: "IN_PROGRESS",
          videoLastPositionSeconds: 120,
          videoWatchedPercent: "50.00",
        }),
      ],
      targetIndex: 0,
      content: { type: "doc", content: [] },
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.progress).not.toBeNull();
    expect(dto.progress?.videoWatchedPercent).toBe(50);
    expect(typeof dto.progress?.videoWatchedPercent).toBe("number");
    expect(dto.progress?.videoLastPositionSeconds).toBe(120);
  });

  it("open without a lesson_progress row answers progress null", () => {
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline: [lessonRow(1)],
      targetIndex: 0,
      content: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.progress).toBeNull();
  });
});

describe("toLessonPageDTO — prev/next", () => {
  it("position 1 with quiz 1 attempted: prevHref null, next unlocked → link", () => {
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline: [
        lessonRow(1, { quizAttempted: true }),
        lessonRow(2),
        lessonRow(3),
      ],
      targetIndex: 0,
      content: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.prevHref).toBeNull();
    expect(dto.next).toEqual({
      kind: "link",
      href: lessonHref(LESSON_COURSE.slug, "materi-2"),
    });
  });

  it("middle with a locked successor: prevHref set, next terkunci", () => {
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline: [
        lessonRow(1, { quizAttempted: true, status: "COMPLETED" }),
        lessonRow(2),
        lessonRow(3),
      ],
      targetIndex: 1,
      content: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.prevHref).toBe(lessonHref(LESSON_COURSE.slug, "materi-1"));
    expect(dto.next).toEqual({ kind: "terkunci", position: 3 });
  });

  it("last lesson: next null (Final Quiz arrives with the quiz card)", () => {
    const last = [
      lessonRow(1, { quizAttempted: true }),
      lessonRow(2, { quizAttempted: true }),
    ];
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1" },
      outline: last,
      targetIndex: 1,
      content: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.next).toBeNull();
    expect(dto.prevHref).toBe(lessonHref(LESSON_COURSE.slug, "materi-1"));
  });
});
