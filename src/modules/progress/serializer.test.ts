// Serializer tests (cards S5-01 §1 + S2-01 §1 + S2-02 §3 + S3-01 §4.A): the
// badge table (PRG-06), the action rule, row by row, plus the allowlist
// proof — only DTO keys leave the module — the lesson-page union (item-state
// priority, next forms, percent Number, outline score, quiz card), and
// resolvePlayback (video status/source → playback DTO). Runs without a
// database (type-only db imports).
import { describe, expect, it } from "vitest";

import { allLessonsCompleted } from "./policy";
import {
  finalQuizHref,
  lessonHref,
  quizHref,
  resolvePlayback,
  toCourseProgressPageDTO,
  toEnrolledCourseDTO,
  toLearnerCourseDTO,
  toLessonPageDTO,
  toMyCourseDTO,
  toOpenQuizDTO,
  type AvailableRow,
  type CourseProgressInput,
  type EnrolledRow,
  type LessonOutlineRow,
  type MyCourseRow,
  type OpenQuizRow,
  type PlaybackSourceRow,
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
  // Card S5-02 §1: null by default — the Final Quiz href tests override it.
  finalQuizId: null as string | null,
};

/** An outline row per position; `quizAttempted` drives the gate. Card
 *  S5-04 added `quizIsPassed` + `videoDurationSeconds` to the row shape —
 *  both default null here (the mechanical fixture update of the query-2
 *  extension; no expectation below changes). */
function lessonRow(position: number, overrides: Partial<LessonOutlineRow> = {}) {
  return {
    id: `lesson-${position}`,
    slug: `materi-${position}`,
    title: `Judul materi ${position}`,
    videoStatus: "NONE" as const,
    videoDurationSeconds: null,
    status: null,
    quizAttempted: null,
    quizScorePercent: null,
    quizIsPassed: null,
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
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline,
      targetIndex: 1,
      content: null,
      playback: null,
      quizRow: null,
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
      lessonRow(1, {
        quizAttempted: true,
        status: "COMPLETED",
        quizScorePercent: "83.33",
      }),
      lessonRow(2),
      lessonRow(3),
    ];
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline,
      targetIndex: 1,
      content: null,
      playback: null,
      quizRow: null,
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
    // Outline score (S3-01 §4.A): FLOORED (S3-02 §3), ONLY on the
    // attempted row — quizAttempted without a stored score reads 0, not
    // null.
    expect(dto.outline.map((item) => item.scorePercent)).toEqual([
      83,
      null,
      null,
    ]);
  });

  it("outline score FLOORS: 69.5 → 69, 69.99 → 69, 70 → 70 (never rounds up)", () => {
    // Card S3-02 §3: the Daftar materi number follows the result screen's
    // rule — a .5 or .99 fraction never rounds up to a passing-looking 70.
    for (const [stored, expected] of [
      ["69.50", 69],
      ["69.99", 69],
      ["70.00", 70],
    ] as const) {
      const dto = toLessonPageDTO({
        course: LESSON_COURSE,
        enrollment: { id: "enr-1", status: "IN_PROGRESS" },
        outline: [
          lessonRow(1, { quizAttempted: true, quizScorePercent: stored }),
        ],
        targetIndex: 0,
        content: null,
        playback: null,
        quizRow: null,
      });
      if (dto.state !== "open") throw new Error("expected open");
      expect(dto.outline[0]!.scorePercent, stored).toBe(expected);
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
      playback: null,
      quizRow: null,
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
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline: threeLessons,
      targetIndex: 2,
      content: null,
      playback: null,
      quizRow: null,
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
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline: [lessonRow(1), lessonRow(2)],
      targetIndex: 1,
      content: null,
      playback: null,
      quizRow: null,
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
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
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
      playback: {
        kind: "youtube",
        videoId: "e2eVideo001",
        durationSeconds: 252,
      },
      quizRow: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.progress).not.toBeNull();
    expect(dto.progress?.videoWatchedPercent).toBe(50);
    expect(typeof dto.progress?.videoWatchedPercent).toBe("number");
    expect(dto.progress?.videoLastPositionSeconds).toBe(120);
    // Open carries the resolved playback verbatim (S2-02 §3), and the
    // allowlist is exact: hasVideo is gone, no raw video_* column leaks.
    expect(dto.lesson.playback).toEqual({
      kind: "youtube",
      videoId: "e2eVideo001",
      durationSeconds: 252,
    });
    expect(Object.keys(dto.lesson).sort()).toEqual(
      ["content", "id", "playback", "position", "title"].sort(),
    );
    // quizRow null (lesson without a quiz / non-open read) answers quiz
    // null — the card simply does not render.
    expect(dto.quiz).toBeNull();
  });

  it("open without a lesson_progress row answers progress null", () => {
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline: [lessonRow(1)],
      targetIndex: 0,
      content: null,
      playback: null,
      quizRow: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.progress).toBeNull();
    expect(dto.lesson.playback).toBeNull();
  });
});

describe("toLessonPageDTO — prev/next", () => {
  it("position 1 with quiz 1 attempted: prevHref null, next unlocked → link", () => {
    const dto = toLessonPageDTO({
      course: LESSON_COURSE,
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline: [
        lessonRow(1, { quizAttempted: true }),
        lessonRow(2),
        lessonRow(3),
      ],
      targetIndex: 0,
      content: null,
      playback: null,
      quizRow: null,
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
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline: [
        lessonRow(1, { quizAttempted: true, status: "COMPLETED" }),
        lessonRow(2),
        lessonRow(3),
      ],
      targetIndex: 1,
      content: null,
      playback: null,
      quizRow: null,
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
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline: last,
      targetIndex: 1,
      content: null,
      playback: null,
      quizRow: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    expect(dto.next).toBeNull();
    expect(dto.prevHref).toBe(lessonHref(LESSON_COURSE.slug, "materi-1"));
  });
});

// ------------------------------------------- finalQuizHref (S5-02 §1/§5)

describe("finalQuizHref", () => {
  it("builds /belajar/{courseSlug}/final-quiz", () => {
    expect(finalQuizHref("gizi-seimbang")).toBe(
      "/belajar/gizi-seimbang/final-quiz",
    );
  });
});

describe("toLessonPageDTO — finalQuizHref on the open state", () => {
  const completed = [
    lessonRow(1, { quizAttempted: true, status: "COMPLETED" }),
    lessonRow(2, { quizAttempted: true, status: "COMPLETED" }),
  ];

  function openDto(
    course: typeof LESSON_COURSE,
    outline: LessonOutlineRow[],
    status: "IN_PROGRESS" | "COMPLETED" | "PASSED" = "IN_PROGRESS",
  ) {
    const dto = toLessonPageDTO({
      course,
      enrollment: { id: "enr-1", status },
      outline,
      targetIndex: outline.length - 1,
      content: null,
      playback: null,
      quizRow: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    return dto;
  }

  it("all lessons COMPLETED + final_quiz_id set → the href", () => {
    const dto = openDto(
      { ...LESSON_COURSE, finalQuizId: "quiz-final-uuid" },
      completed,
    );
    expect(dto.finalQuizHref).toBe(finalQuizHref(LESSON_COURSE.slug));
  });

  it("all lessons COMPLETED but no final_quiz_id → null", () => {
    expect(openDto(LESSON_COURSE, completed).finalQuizHref).toBeNull();
  });

  it("one lesson still IN_PROGRESS → null even with final_quiz_id set", () => {
    const dto = openDto(
      { ...LESSON_COURSE, finalQuizId: "quiz-final-uuid" },
      [completed[0]!, lessonRow(2, { quizAttempted: true })],
    );
    expect(dto.finalQuizHref).toBeNull();
  });

  it("a lesson without a progress row (status null) → null — the gate needs EVERY lesson", () => {
    const dto = openDto(
      { ...LESSON_COURSE, finalQuizId: "quiz-final-uuid" },
      [completed[0]!, lessonRow(2)],
    );
    expect(dto.finalQuizHref).toBeNull();
  });

  it("empty outline never reaches the open state — the gate helper itself answers false", () => {
    // The serializer throws on an empty target before any state exists, so
    // the empty-course rule lives in the policy helper the gate composes.
    expect(allLessonsCompleted([])).toBe(false);
    expect(allLessonsCompleted([{ status: "COMPLETED" }])).toBe(true);
    expect(allLessonsCompleted([{ status: null }])).toBe(false);
  });

  it("locked and not-enrolled states carry no finalQuizHref key at all", () => {
    const locked = toLessonPageDTO({
      course: { ...LESSON_COURSE, finalQuizId: "quiz-final-uuid" },
      enrollment: { id: "enr-1", status: "IN_PROGRESS" },
      outline: [lessonRow(1), lessonRow(2)],
      targetIndex: 1,
      content: null,
      playback: null,
      quizRow: null,
    });
    expect("finalQuizHref" in locked).toBe(false);
    expect("finalQuizDone" in locked).toBe(false);
    const notEnrolled = toLessonPageDTO({
      course: { ...LESSON_COURSE, finalQuizId: "quiz-final-uuid" },
      enrollment: undefined,
      outline: [lessonRow(1)],
      targetIndex: 0,
      content: null,
      playback: null,
      quizRow: null,
    });
    expect("finalQuizHref" in notEnrolled).toBe(false);
    expect("finalQuizDone" in notEnrolled).toBe(false);
  });
});

describe("toLessonPageDTO — finalQuizDone on the open state (S3-02 §5)", () => {
  const completed = [
    lessonRow(1, { quizAttempted: true, status: "COMPLETED" }),
    lessonRow(2, { quizAttempted: true, status: "COMPLETED" }),
  ];
  const withFinal = { ...LESSON_COURSE, finalQuizId: "quiz-final-uuid" };

  function openDto(
    course: typeof LESSON_COURSE,
    outline: LessonOutlineRow[],
    status: "IN_PROGRESS" | "COMPLETED" | "PASSED" = "IN_PROGRESS",
  ) {
    const dto = toLessonPageDTO({
      course,
      enrollment: { id: "enr-1", status },
      outline,
      targetIndex: outline.length - 1,
      content: null,
      playback: null,
      quizRow: null,
    });
    if (dto.state !== "open") throw new Error("expected open");
    return dto;
  }

  it("IN_PROGRESS → false even with the gate open (Final not worked yet)", () => {
    expect(openDto(withFinal, completed).finalQuizDone).toBe(false);
  });

  it("COMPLETED → true — a failed Final was still WORKED", () => {
    expect(openDto(withFinal, completed, "COMPLETED").finalQuizDone).toBe(true);
  });

  it("PASSED → true", () => {
    expect(openDto(withFinal, completed, "PASSED").finalQuizDone).toBe(true);
  });

  it("no final_quiz_id (finalQuizHref null) + PASSED → false", () => {
    // A course without a Final Quiz never says "Hasil Final Quiz", no
    // matter how the enrollment status reads.
    expect(openDto(LESSON_COURSE, completed, "PASSED").finalQuizDone).toBe(
      false,
    );
  });
});

// ------------------------------------------------------ quiz card (S3-01 §4.A)

describe("quizHref", () => {
  it("builds /belajar/{courseSlug}/{lessonSlug}/quiz", () => {
    expect(quizHref("gizi-seimbang", LESSON_A)).toBe(
      `/belajar/gizi-seimbang/${LESSON_A}/quiz`,
    );
  });
});

function openQuizRow(overrides: Partial<OpenQuizRow> = {}): OpenQuizRow {
  return {
    title: "Quiz materi 1",
    durationMinutes: 10,
    questionCount: 3,
    attemptStatus: null,
    quizAttempted: null,
    ...overrides,
  };
}

describe("toOpenQuizDTO", () => {
  const hrefs = { courseSlug: "gizi-seimbang", lessonSlug: LESSON_A };

  it("state: quiz_attempted beats a live attempt, a live attempt beats nothing", () => {
    // quiz_attempted is the durable flag in lesson_progress; the live
    // attempt only separates belum from berjalan.
    expect(
      toOpenQuizDTO(
        openQuizRow({ quizAttempted: true, attemptStatus: "SUBMITTED" }),
        { videoStatus: "READY", videoWatchedPercent: "95.00" },
        hrefs,
      ).state,
    ).toBe("selesai");
    expect(
      toOpenQuizDTO(
        openQuizRow({ attemptStatus: "IN_PROGRESS" }),
        { videoStatus: "READY", videoWatchedPercent: "95.00" },
        hrefs,
      ).state,
    ).toBe("berjalan");
    expect(
      toOpenQuizDTO(openQuizRow(), { videoStatus: "NONE", videoWatchedPercent: null }, hrefs)
        .state,
    ).toBe("belum");
  });

  it("eligible: >= 90 counts, below does not; no READY video is eligible from the start", () => {
    expect(
      toOpenQuizDTO(openQuizRow(), { videoStatus: "READY", videoWatchedPercent: "90.00" }, hrefs)
        .eligible,
    ).toBe(true);
    expect(
      toOpenQuizDTO(openQuizRow(), { videoStatus: "READY", videoWatchedPercent: "89.99" }, hrefs)
        .eligible,
    ).toBe(false);
    // No progress row at all on a READY-video lesson: 0 %, not eligible.
    expect(
      toOpenQuizDTO(openQuizRow(), { videoStatus: "READY", videoWatchedPercent: null }, hrefs)
        .eligible,
    ).toBe(false);
    expect(
      toOpenQuizDTO(openQuizRow(), { videoStatus: "NONE", videoWatchedPercent: null }, hrefs)
        .eligible,
    ).toBe(true);
  });

  it("returns exactly the allowlisted keys, href through quizHref", () => {
    const dto = toOpenQuizDTO(
      openQuizRow(),
      { videoStatus: "READY", videoWatchedPercent: "95.00" },
      hrefs,
    );
    expect(Object.keys(dto).sort()).toEqual(
      [
        "state",
        "eligible",
        "title",
        "questionCount",
        "durationMinutes",
        "href",
      ].sort(),
    );
    expect(dto.href).toBe(`/belajar/gizi-seimbang/${LESSON_A}/quiz`);
    expect(dto.title).toBe("Quiz materi 1");
    expect(dto.questionCount).toBe(3);
    expect(dto.durationMinutes).toBe(10);
  });
});

// ------------------------------------------------- resolvePlayback (S2-02 §3)

/** A row with every video column overridable; the CHECK constraint the DB
 *  enforces (lesson-video.integration.test.ts) is out of scope here — the
 *  serializer must stay safe for ANY row it is handed. */
function videoRow(
  overrides: Partial<PlaybackSourceRow> = {},
): PlaybackSourceRow {
  return {
    videoStatus: "READY",
    videoProvider: "YOUTUBE",
    videoExternalId: "e2eVideo001",
    videoKey: null,
    videoDurationSeconds: 252,
    ...overrides,
  };
}

describe("resolvePlayback", () => {
  it("READY + YOUTUBE + valid id → the youtube DTO", () => {
    expect(resolvePlayback(videoRow())).toEqual({
      kind: "youtube",
      videoId: "e2eVideo001",
      durationSeconds: 252,
    });
  });

  it("durationSeconds null or ≤ 0 answers null, never 0/negative", () => {
    for (const durationSeconds of [null, 0, -30]) {
      expect(
        resolvePlayback(videoRow({ videoDurationSeconds: durationSeconds })),
      ).toEqual({
        kind: "youtube",
        videoId: "e2eVideo001",
        durationSeconds: null,
      });
    }
  });

  it("every status below READY answers null — with a VALID youtube source attached, so the status is the only reason", () => {
    // Provider YOUTUBE + a valid 11-char id on every row: if any of these
    // rows stopped answering null, it would be the status check that
    // broke, not the source parsing.
    for (const videoStatus of ["NONE", "UPLOADING", "FAILED"] as const) {
      expect(
        resolvePlayback(videoRow({ videoStatus })),
        videoStatus,
      ).toBeNull();
    }
  });

  it("READY + R2 (with a key) and READY + no provider answer null until S1-05", () => {
    expect(
      resolvePlayback(
        videoRow({
          videoProvider: "R2",
          videoExternalId: null,
          videoKey: "materi/materi-1.mp4",
        }),
      ),
    ).toBeNull();
    expect(
      resolvePlayback(
        videoRow({ videoProvider: null, videoExternalId: null }),
      ),
    ).toBeNull();
  });

  it("READY + FAILED-like mismatches answer null: R2 key missing, id empty", () => {
    // FAILED + R2 + a real video_key: status still wins (null) — the row
    // shape the uploader leaves behind mid-retry.
    expect(
      resolvePlayback(
        videoRow({
          videoStatus: "FAILED",
          videoProvider: "R2",
          videoExternalId: null,
          videoKey: "materi/materi-1.mp4",
        }),
      ),
    ).toBeNull();
    // A null id maps to "" rather than crashing on a row the DB CHECK
    // already keeps out — mapping stays total, the constraint is the guard.
    expect(resolvePlayback(videoRow({ videoExternalId: null }))).toEqual({
      kind: "youtube",
      videoId: "",
      durationSeconds: 252,
    });
  });
});

// ------------------------------------------------ S5-04 Kursus Saya + progres

const MY_NOW = new Date("2026-11-18T08:00:00.000Z");
const MY_ENROLLED = new Date("2026-09-12T03:00:00.000Z");
const MY_COMPLETED = new Date("2026-11-01T05:00:00.000Z");

function myCourseRow(overrides: Partial<MyCourseRow> = {}): MyCourseRow {
  return {
    id: "6f38a3b3-3333-4333-8333-333333333333",
    slug: "gizi-seimbang",
    title: "Gizi Seimbang",
    level: "BEGINNER",
    enrollmentStatus: "IN_PROGRESS",
    lastLessonId: null,
    lastLessonSlug: null,
    lastLessonTitle: null,
    firstLessonSlug: LESSON_A,
    lessonCount: 6,
    completedLessonCount: 0,
    finalScorePercent: null,
    completedAt: null,
    enrolledAt: MY_ENROLLED,
    updatedAt: MY_NOW,
    estimatedMinutes: null,
    ...overrides,
  };
}

describe("toMyCourseDTO", () => {
  it("returns exactly the allowlisted keys", () => {
    const dto = toMyCourseDTO(myCourseRow());
    expect(Object.keys(dto).sort()).toEqual(
      [
        "id",
        "slug",
        "title",
        "badge",
        "lessonCount",
        "completedLessonCount",
        "meta",
        "finalScorePercent",
        "lastLessonTitle",
        "estimatedMinutes",
        "continueHref",
        "progressHref",
      ].sort(),
    );
  });

  it("meta per badge: terakhir-dibuka / selesai (completed_at, updated_at fallback) / diikuti", () => {
    expect(
      toMyCourseDTO(
        myCourseRow({ lastLessonId: "l1", lastLessonSlug: LESSON_Z }),
      ).meta,
    ).toEqual({ kind: "terakhir-dibuka", at: MY_NOW.toISOString() });

    expect(
      toMyCourseDTO(
        myCourseRow({
          enrollmentStatus: "COMPLETED",
          completedAt: MY_COMPLETED,
        }),
      ).meta,
    ).toEqual({ kind: "selesai", at: MY_COMPLETED.toISOString() });

    // PASSED with a NULL completed_at falls back to updated_at.
    expect(
      toMyCourseDTO(myCourseRow({ enrollmentStatus: "PASSED" })).meta,
    ).toEqual({ kind: "selesai", at: MY_NOW.toISOString() });

    expect(
      toMyCourseDTO(myCourseRow({ enrollmentStatus: "IN_PROGRESS" })).meta,
    ).toEqual({ kind: "diikuti", at: MY_ENROLLED.toISOString() });
  });

  it("finalScorePercent: Math.round, only selesai/lulus — null elsewhere even when stored", () => {
    expect(
      toMyCourseDTO(
        myCourseRow({
          enrollmentStatus: "PASSED",
          finalScorePercent: "67.50",
        }),
      ).finalScorePercent,
    ).toBe(68);
    expect(
      toMyCourseDTO(
        myCourseRow({
          enrollmentStatus: "COMPLETED",
          finalScorePercent: "67.50",
        }),
      ).finalScorePercent,
    ).toBe(68);
    expect(
      toMyCourseDTO(
        myCourseRow({ finalScorePercent: "91.40" }),
      ).finalScorePercent,
    ).toBeNull();
  });

  it("lastLessonTitle only sedang-berjalan; estimatedMinutes only belum-dimulai", () => {
    expect(
      toMyCourseDTO(
        myCourseRow({
          lastLessonId: "l1",
          lastLessonTitle: "Camilan aman",
          estimatedMinutes: 38,
        }),
      ),
    ).toMatchObject({ lastLessonTitle: "Camilan aman", estimatedMinutes: null });
    expect(
      toMyCourseDTO(
        myCourseRow({
          enrollmentStatus: "PASSED",
          lastLessonTitle: "Camilan aman",
          estimatedMinutes: 38,
        }),
      ),
    ).toMatchObject({ lastLessonTitle: null, estimatedMinutes: null });
  });

  it("continueHref follows lastLessonSlug ?? first (the dashboard action rule)", () => {
    expect(
      toMyCourseDTO(
        myCourseRow({ lastLessonId: "l1", lastLessonSlug: LESSON_Z }),
      ).continueHref,
    ).toBe(lessonHref("gizi-seimbang", LESSON_Z));
    expect(toMyCourseDTO(myCourseRow()).continueHref).toBe(
      lessonHref("gizi-seimbang", LESSON_A),
    );
    expect(toMyCourseDTO(myCourseRow()).progressHref).toBe(
      "/belajar/gizi-seimbang",
    );
  });
});

const PROGRESS_COURSE = {
  id: "course-uuid",
  slug: "gizi-seimbang",
  title: "Gizi Seimbang",
  isSequential: false,
  finalQuizId: "quiz-final-uuid" as string | null,
};

function progressEnrollment(
  overrides: Partial<CourseProgressInput["enrollment"]> = {},
): CourseProgressInput["enrollment"] {
  return {
    id: "enr-1",
    lastLessonId: null,
    status: "IN_PROGRESS",
    finalScorePercent: null,
    updatedAt: MY_NOW,
    ...overrides,
  };
}

function progressInput(
  overrides: Partial<CourseProgressInput> = {},
): CourseProgressInput {
  return {
    course: PROGRESS_COURSE,
    enrollment: progressEnrollment(),
    outline: [],
    finalQuiz: { durationMinutes: 20, questionCount: 10 },
    ...overrides,
  };
}

describe("toCourseProgressPageDTO — lesson rows", () => {
  it("returns exactly the allowlisted keys (page and lesson DTO)", () => {
    const dto = toCourseProgressPageDTO(progressInput());
    expect(dto.state).toBe("progres");
    if (dto.state !== "progres") return;
    expect(Object.keys(dto).sort()).toEqual(
      [
        "state",
        "course",
        "badge",
        "lessonCount",
        "completedLessonCount",
        "lastActivityAt",
        "lessons",
        "final",
        "lessonAveragePercent",
        "gradedLessonCount",
        "hasFailedLesson",
        "finalScorePercent",
      ].sort(),
    );
    const lesson = toCourseProgressPageDTO(
      progressInput({ outline: [lessonRow(1)] }),
    );
    if (lesson.state !== "progres") return;
    expect(Object.keys(lesson.lessons[0]!).sort()).toEqual(
      [
        "position",
        "title",
        "status",
        "href",
        "hasVideo",
        "scorePercent",
        "isPassed",
        "video",
      ].sort(),
    );
  });

  it("non-sequential course: the five statuses in one outline", () => {
    const dto = toCourseProgressPageDTO(
      progressInput({
        outline: [
          lessonRow(1, {
            status: "COMPLETED",
            quizAttempted: true,
            quizScorePercent: "90.00",
            quizIsPassed: true,
          }),
          lessonRow(2, {
            status: "COMPLETED",
            quizAttempted: true,
            quizScorePercent: "67.00",
            quizIsPassed: false,
          }),
          lessonRow(3, { status: "IN_PROGRESS" }),
          lessonRow(4, {
            status: "IN_PROGRESS",
            videoStatus: "READY",
            videoDurationSeconds: 100,
            videoLastPositionSeconds: 40,
            videoWatchedPercent: "40.00",
          }),
          lessonRow(5),
        ],
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    expect(dto.lessons.map((lesson) => lesson.status)).toEqual([
      "selesai",
      "selesai",
      "quiz-belum",
      "sedang-dipelajari",
      "belum-mulai",
    ]);
    expect(
      dto.lessons.every((lesson) =>
        lesson.href?.startsWith("/belajar/gizi-seimbang/"),
      ),
    ).toBe(true);
    expect(dto.lessons[0]!).toMatchObject({
      scorePercent: 90,
      isPassed: true,
      hasVideo: false,
      video: null,
    });
    expect(dto.lessons[1]!).toMatchObject({
      scorePercent: 67,
      isPassed: false,
    });
    expect(dto.lessons[2]!).toMatchObject({ scorePercent: null, video: null });
    expect(dto.lessons[3]!.video).toEqual({
      positionSeconds: 40,
      durationSeconds: 100,
    });
    expect(dto.lessons[4]!.video).toBeNull();
  });

  it("sequential: gate locks unattempted successors (href null); COMPLETED beats the re-locked gate", () => {
    const dto = toCourseProgressPageDTO(
      progressInput({
        course: { ...PROGRESS_COURSE, isSequential: true },
        outline: [
          lessonRow(1, { quizAttempted: true, status: "COMPLETED" }),
          lessonRow(2),
          lessonRow(3, { status: "COMPLETED", quizAttempted: true }),
        ],
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    // Lesson 2's predecessor was attempted → open; lesson 3's (lesson 2)
    // was NOT → the gate re-locks it, but COMPLETED outranks the gate.
    expect(dto.lessons.map((lesson) => lesson.status)).toEqual([
      "selesai",
      "belum-mulai",
      "selesai",
    ]);
    expect(dto.lessons[1]!.href).toBe(lessonHref("gizi-seimbang", "materi-2"));
  });

  it("quiz-belum requires eligibility: a READY video at 40 % reads sedang-dipelajari, ≥ 90 % reads quiz-belum", () => {
    const dto = toCourseProgressPageDTO(
      progressInput({
        outline: [
          lessonRow(1, {
            status: "IN_PROGRESS",
            videoStatus: "READY",
            videoWatchedPercent: "40.00",
            videoDurationSeconds: 100,
            videoLastPositionSeconds: 40,
          }),
          lessonRow(2, {
            status: "IN_PROGRESS",
            videoStatus: "READY",
            videoWatchedPercent: "90.00",
          }),
        ],
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    expect(dto.lessons[0]!.status).toBe("sedang-dipelajari");
    expect(dto.lessons[1]!.status).toBe("quiz-belum");
  });

  it("quiz attempted without COMPLETED stays sedang-dipelajari — with its video DTO on that branch", () => {
    // Decision 3 row 3: the quiz is done, the video requirement is not.
    // The video clock renders on THIS branch just like on row 5.
    const dto = toCourseProgressPageDTO(
      progressInput({
        outline: [
          lessonRow(1, {
            status: "IN_PROGRESS",
            quizAttempted: true,
            quizScorePercent: "80.00",
            quizIsPassed: true,
            videoStatus: "READY",
            videoWatchedPercent: "40.00",
            videoDurationSeconds: 100,
            videoLastPositionSeconds: 40,
          }),
        ],
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    expect(dto.lessons[0]!.status).toBe("sedang-dipelajari");
    expect(dto.lessons[0]!.video).toEqual({
      positionSeconds: 40,
      durationSeconds: 100,
    });
  });

  it("video.positionSeconds is clamped to durationSeconds (schema allows +5 s)", () => {
    const dto = toCourseProgressPageDTO(
      progressInput({
        outline: [
          lessonRow(1, {
            status: "IN_PROGRESS",
            videoStatus: "READY",
            videoDurationSeconds: 100,
            videoLastPositionSeconds: 103,
            videoWatchedPercent: "40.00",
          }),
        ],
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    expect(dto.lessons[0]!.video).toEqual({
      positionSeconds: 100,
      durationSeconds: 100,
    });
  });

  it("scorePercent FLOORS the stored NUMERIC (69.99 → 69)", () => {
    const dto = toCourseProgressPageDTO(
      progressInput({
        outline: [
          lessonRow(1, {
            status: "COMPLETED",
            quizAttempted: true,
            quizScorePercent: "69.99",
          }),
        ],
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    expect(dto.lessons[0]!.scorePercent).toBe(69);
  });
});

describe("toCourseProgressPageDTO — final", () => {
  const completedOutline = [
    lessonRow(1, { status: "COMPLETED", quizAttempted: true, quizScorePercent: "80.00" }),
    lessonRow(2, { status: "COMPLETED", quizAttempted: true, quizScorePercent: "80.00" }),
  ];

  it("locked while a lesson is unfinished; open when all COMPLETED + IN_PROGRESS; done when the status left IN_PROGRESS", () => {
    const locked = toCourseProgressPageDTO(progressInput({ outline: completedOutline.map((row, i) => (i === 0 ? row : lessonRow(2))) }));
    if (locked.state !== "progres") throw new Error("expected progres");
    expect(locked.final).toMatchObject({ status: "terkunci" });
    expect(locked.final!.href).toBe(finalQuizHref("gizi-seimbang"));
    expect(locked.final!.questionCount).toBe(10);
    expect(locked.final!.durationMinutes).toBe(20);

    const open = toCourseProgressPageDTO(progressInput({ outline: completedOutline }));
    if (open.state !== "progres") throw new Error("expected progres");
    expect(open.final!.status).toBe("terbuka");

    const done = toCourseProgressPageDTO(
      progressInput({
        outline: completedOutline,
        enrollment: progressEnrollment({ status: "PASSED" }),
      }),
    );
    if (done.state !== "progres") throw new Error("expected progres");
    expect(done.final!.status).toBe("selesai");
  });

  it("null when the course has no Final Quiz or the summary missed", () => {
    const noFinal = toCourseProgressPageDTO(
      progressInput({
        course: { ...PROGRESS_COURSE, finalQuizId: null },
        outline: completedOutline,
      }),
    );
    if (noFinal.state !== "progres") throw new Error("expected progres");
    expect(noFinal.final).toBeNull();

    const missed = toCourseProgressPageDTO(
      progressInput({ outline: completedOutline, finalQuiz: null }),
    );
    if (missed.state !== "progres") throw new Error("expected progres");
    expect(missed.final).toBeNull();
  });
});

describe("toCourseProgressPageDTO — ringkasan", () => {
  it("lessonAveragePercent rounds the RAW scores: two '66.67' → 67 (never the floored 66)", () => {
    // The ungraded rows must stay OUT of the average and the count.
    const dto = toCourseProgressPageDTO(
      progressInput({
        outline: [
          lessonRow(1, {
            status: "COMPLETED",
            quizAttempted: true,
            quizScorePercent: "66.67",
            quizIsPassed: true,
          }),
          lessonRow(2, {
            status: "COMPLETED",
            quizAttempted: true,
            quizScorePercent: "66.67",
            quizIsPassed: false,
          }),
          lessonRow(3),
        ],
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    expect(dto.lessonAveragePercent).toBe(67);
    expect(dto.gradedLessonCount).toBe(2);
    expect(dto.hasFailedLesson).toBe(true);
  });

  it("null average + zero graded before any score; hasFailedLesson false without a failed row", () => {
    const dto = toCourseProgressPageDTO(
      progressInput({
        outline: [
          lessonRow(1, { status: "IN_PROGRESS" }),
          lessonRow(2, { status: "COMPLETED", quizAttempted: true, quizScorePercent: "90.00", quizIsPassed: true }),
        ],
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    expect(dto.lessonAveragePercent).toBe(90);
    expect(dto.hasFailedLesson).toBe(false);

    const empty = toCourseProgressPageDTO(progressInput({ outline: [lessonRow(1)] }));
    if (empty.state !== "progres") throw new Error("expected progres");
    expect(empty.lessonAveragePercent).toBeNull();
    expect(empty.gradedLessonCount).toBe(0);
  });

  it("finalScorePercent: Math.round, only when the stored status left IN_PROGRESS", () => {
    const running = toCourseProgressPageDTO(
      progressInput({
        enrollment: progressEnrollment({ finalScorePercent: "68.00" }),
      }),
    );
    if (running.state !== "progres") throw new Error("expected progres");
    expect(running.finalScorePercent).toBeNull();

    const done = toCourseProgressPageDTO(
      progressInput({
        enrollment: progressEnrollment({
          status: "COMPLETED",
          finalScorePercent: "67.50",
        }),
      }),
    );
    if (done.state !== "progres") throw new Error("expected progres");
    expect(done.finalScorePercent).toBe(68);
  });

  it("badge + counts + lastActivityAt come from the enrollment and outline", () => {
    const dto = toCourseProgressPageDTO(
      progressInput({
        outline: [
          lessonRow(1, { status: "COMPLETED", quizAttempted: true }),
          lessonRow(2),
        ],
        enrollment: progressEnrollment({
          status: "PASSED",
          lastLessonId: "lesson-2",
          updatedAt: MY_NOW,
        }),
      }),
    );
    if (dto.state !== "progres") throw new Error("expected progres");
    expect(dto.badge).toBe("lulus");
    expect(dto.lessonCount).toBe(2);
    expect(dto.completedLessonCount).toBe(1);
    expect(dto.lastActivityAt).toBe(MY_NOW.toISOString());
    expect(dto.course).toEqual({ id: "course-uuid", title: "Gizi Seimbang" });
  });
});
