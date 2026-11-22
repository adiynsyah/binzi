// Explicit serialization for the progress module (card S5-01 §1,
// card S2-01 §1, card S2-02 §3; PRD §12.6 V-01/V-05).
//
// Module-internal: consumers outside the module get the DTO types
// re-exported from service.ts. No database access on purpose — the RUNTIME
// imports are the gate helpers from ./policy (same module) AND the course
// module's schema file (COURSE_LEVEL_LABELS, read at runtime — allowed
// across modules); only the db schema comes in as a type-only import — so
// the serializer tests run without a database.
//
// Every function builds a fresh object from an explicit allowlist, so a
// column not listed (description, progressPercent, lastLessonId, …) can
// never leak even if a future query starts selecting it.
import type {
  attemptStatusEnum,
  enrollmentStatusEnum,
  progressStatusEnum,
  videoProviderEnum,
  videoStatusEnum,
} from "@/db/schema";
import { COURSE_LEVEL_LABELS, type CourseLevel } from "@/modules/course/schema";

import {
  allLessonsCompleted,
  courseLessonStatus,
  firstOpenUnattempted,
  isLessonUnlocked,
  isQuizEligible,
  type CourseLessonStatus,
} from "./policy";

/** The enrolled SELECT's row shape (queries.ts). */
export type EnrolledRow = {
  id: string;
  slug: string;
  title: string;
  level: CourseLevel;
  enrollmentStatus: (typeof enrollmentStatusEnum.enumValues)[number];
  lastLessonId: string | null;
  /** Slug of the last-opened lesson, NULL when unset OR pointing at a
   *  lesson that no longer belongs to this course (the subquery scopes
   *  lst.course_id = courses.id). */
  lastLessonSlug: string | null;
  lessonCount: number;
  completedLessonCount: number;
  firstLessonSlug: string | null;
};

/** The available SELECT's row shape (queries.ts). */
export type AvailableRow = {
  id: string;
  slug: string;
  title: string;
  level: CourseLevel;
  summary: string | null;
  estimatedMinutes: number | null;
  lessonCount: number;
  firstLessonSlug: string | null;
};

export type LearnerCourseDTO = {
  id: string;
  slug: string;
  title: string;
  /** COURSE_LEVEL_LABELS lookup ("Pemula", …) — UI-ready. */
  levelLabel: string;
  summary: string | null;
  estimatedMinutes: number | null;
  lessonCount: number;
  /** lessonHref(course slug, first lesson slug). */
  startHref: string;
};

export type EnrolledCourseDTO = {
  id: string;
  slug: string;
  title: string;
  levelLabel: string;
  lessonCount: number;
  completedLessonCount: number;
  /** PRG-06 statuses; "lulus" replaces "selesai" when the course passed. */
  badge: "belum-dimulai" | "sedang-berjalan" | "selesai" | "lulus";
  action: { kind: "mulai" | "lanjutkan"; href: string };
};

export type LearnerDashboardDTO = {
  enrolled: EnrolledCourseDTO[];
  available: LearnerCourseDTO[];
};

export type EnrollResultDTO = {
  courseId: string;
  startHref: string;
};

/** POST /api/progress/video's answer (card §3): the STORED values, with
 *  watchedPercent already Number()'d out of its NUMERIC string. */
export type VideoProgressResultDTO = {
  positionSeconds: number;
  watchedPercent: number;
};

// ------------------------------------------------- S5-04 Kursus Saya (13b)

/** selectMyCourses' row shape (queries.ts) — the dashboard's enrolled
 *  SELECT plus the meta/sub-row/result columns the page adds. */
export type MyCourseRow = {
  id: string;
  slug: string;
  title: string;
  level: CourseLevel;
  enrollmentStatus: (typeof enrollmentStatusEnum.enumValues)[number];
  lastLessonId: string | null;
  /** Slug of the last-opened lesson, NULL when unset OR stale (the subquery
   *  bounds lst.course_id = courses.id) — continueHref's first input. */
  lastLessonSlug: string | null;
  /** Same bound, the TITLE — the card's "Terakhir dibuka: {judul}" line. */
  lastLessonTitle: string | null;
  firstLessonSlug: string | null;
  lessonCount: number;
  completedLessonCount: number;
  /** NUMERIC as it leaves the driver — rounded below, selesai/lulus only. */
  finalScorePercent: string | null;
  completedAt: Date | null;
  enrolledAt: Date;
  updatedAt: Date;
  estimatedMinutes: number | null;
};

export type MyCourseDTO = {
  id: string;
  slug: string;
  title: string;
  /** PRG-06 via the SAME badgeOf as the dashboard (no second copy). */
  badge: "belum-dimulai" | "sedang-berjalan" | "selesai" | "lulus";
  lessonCount: number;
  completedLessonCount: number;
  meta: { kind: "terakhir-dibuka" | "selesai" | "diikuti"; at: string }; // ISO
  finalScorePercent: number | null; // Math.round; only selesai/lulus
  lastLessonTitle: string | null; // only sedang-berjalan
  estimatedMinutes: number | null; // only belum-dimulai
  continueHref: string; // lessonHref(last ?? first) — the dashboard action rule
  progressHref: string; // /belajar/{slug}
};

export type MyCoursesPageDTO = {
  courses: MyCourseDTO[];
  /** Filled only when `courses` is empty (the 13c empty state's list). */
  available: LearnerCourseDTO[];
};

// ------------------------------------------- S5-04 course progress (8c)

export type CourseProgressLessonDTO = {
  position: number;
  title: string;
  status: CourseLessonStatus; // decision 3 — courseLessonStatus in policy.ts
  href: string | null; // null only for terkunci
  hasVideo: boolean; // video_status READY
  scorePercent: number | null; // Math.floor; only when the quiz was attempted
  isPassed: boolean | null; // stored quiz_is_passed
  /** Only sedang-dipelajari + READY + duration > 0 (both decision-3
   *  branches); positionSeconds clamped to durationSeconds (the schema
   *  allows +5 s of slack — never render "01:43 / 01:40"). */
  video: { positionSeconds: number; durationSeconds: number } | null;
};

export type CourseProgressPageDTO =
  | { state: "kembali"; href: string }
  | {
      state: "progres";
      course: { id: string; title: string };
      badge: "belum-dimulai" | "sedang-berjalan" | "selesai" | "lulus";
      lessonCount: number;
      completedLessonCount: number;
      lastActivityAt: string; // enrollments.updated_at, ISO
      lessons: CourseProgressLessonDTO[];
      final: {
        status: "terkunci" | "terbuka" | "selesai"; // decision 4
        href: string; // finalQuizHref
        questionCount: number;
        durationMinutes: number;
      } | null; // course without a Final Quiz (unreachable with valid data)
      /** Math.round over the RAW NUMERIC scores of the graded rows — the
       *  Nilai Saya / loadFinalQuizContext rule, never the floored display
       *  values. Null before the first graded lesson. */
      lessonAveragePercent: number | null;
      gradedLessonCount: number;
      hasFailedLesson: boolean; // a graded row with isPassed === false
      finalScorePercent: number | null; // Math.round; only when status ≠ IN_PROGRESS
    };

/** What the service hands toCourseProgressPageDTO: the PUBLISHED course,
 *  the actor's enrollment, the shared outline rows, and the Final Quiz
 *  summary (null for a course without one — or a summary miss). */
export type CourseProgressInput = {
  course: {
    id: string;
    slug: string;
    title: string;
    isSequential: boolean;
    finalQuizId: string | null;
  };
  enrollment: {
    id: string;
    lastLessonId: string | null;
    status: (typeof enrollmentStatusEnum.enumValues)[number];
    finalScorePercent: string | null;
    updatedAt: Date;
  };
  outline: readonly LessonOutlineRow[];
  finalQuiz: { durationMinutes: number; questionCount: number } | null;
};

// ---------------------------------------------------------- lesson page

/**
 * The playback source of an OPEN lesson (card S2-02 §3, video-sumber.md
 * §2): `youtube` is the demo source, `file` arrives with S1-05 (presigned
 * GET, A-17). Raw video columns never leave the module — only this DTO.
 */
export type PlaybackDTO =
  | { kind: "youtube"; videoId: string; durationSeconds: number | null }
  | { kind: "file"; url: string; expiresAt: string; durationSeconds: number | null };

/** The video-source columns selectOpenLesson reads (queries.ts). */
export type PlaybackSourceRow = {
  videoStatus: (typeof videoStatusEnum.enumValues)[number];
  videoProvider: (typeof videoProviderEnum.enumValues)[number] | null;
  videoExternalId: string | null;
  videoKey: string | null;
  videoDurationSeconds: number | null;
};

/**
 * The ONE source picker (card §3): a full switch over video_provider, so
 * S1-05 can only ADD the file branch. Not-READY answers null no matter
 * the source columns; the duration follows the recordVideoProgress rule
 * (null when the column is null or ≤ 0).
 */
export function resolvePlayback(row: PlaybackSourceRow): PlaybackDTO | null {
  if (row.videoStatus !== "READY") return null;
  switch (row.videoProvider) {
    case "YOUTUBE":
      return {
        kind: "youtube",
        // The CHECK guarantees a valid 11-char id whenever READY+YOUTUBE;
        // the ?? "" only satisfies the DTO's string type on impossible rows.
        videoId: row.videoExternalId ?? "",
        durationSeconds:
          row.videoDurationSeconds !== null && row.videoDurationSeconds > 0
            ? row.videoDurationSeconds
            : null,
      };
    case "R2":
      // File branch: S1-05 (presigned GET, A-17).
      return null;
    case null:
      // Unreachable while the lessons_video_source_check holds; still null.
      return null;
    default: {
      // Exhaustiveness guard: adding an enum value without a branch fails
      // this assignment at compile time.
      const _exhaustive: never = row.videoProvider;
      return _exhaustive;
    }
  }
}


// ------------------------------------------------------------- S3-01 quiz card

/** selectOpenLessonQuiz's row shape (queries.ts) — read only for an open
 *  lesson. `attemptStatus` is the actor's live (reset_at NULL) attempt. */
export type OpenQuizRow = {
  title: string;
  durationMinutes: number;
  questionCount: number;
  attemptStatus: (typeof attemptStatusEnum.enumValues)[number] | null;
  quizAttempted: boolean | null;
};

/** The quiz card on an open lesson (card S3-01 §4.A) — the ONLY quiz data
 *  the lesson page carries; nothing about questions/options/answers. */
export type OpenQuizDTO = {
  state: "belum" | "berjalan" | "selesai";
  eligible: boolean;
  title: string;
  questionCount: number;
  durationMinutes: number;
  href: string;
};

/** `/belajar/{courseSlug}/{lessonSlug}/quiz` — the quiz page href (card
 *  S3-01 §4.A), sibling of lessonHref. */
export function quizHref(courseSlug: string, lessonSlug: string): string {
  return `/belajar/${courseSlug}/${lessonSlug}/quiz`;
}

/** `/belajar/{courseSlug}/final-quiz` — the Final Quiz page href (card
 *  S5-02 §1), the third sibling. */
export function finalQuizHref(courseSlug: string): string {
  return `/belajar/${courseSlug}/final-quiz`;
}

/**
 * The open quiz card's DTO: "selesai" wins when the quiz was attempted
 * (lesson_progress.quiz_attempted), then "berjalan" for a live attempt,
 * else "belum". `eligible` is the SAME video rule the start endpoint
 * enforces (isQuizEligible) so the button never lies.
 */
export function toOpenQuizDTO(
  row: OpenQuizRow,
  target: Pick<LessonOutlineRow, "videoStatus" | "videoWatchedPercent">,
  hrefs: { courseSlug: string; lessonSlug: string },
): OpenQuizDTO {
  const state: OpenQuizDTO["state"] =
    row.quizAttempted === true
      ? "selesai"
      : row.attemptStatus === "IN_PROGRESS"
        ? "berjalan"
        : "belum";
  return {
    state,
    eligible: isQuizEligible(target),
    title: row.title,
    questionCount: row.questionCount,
    durationMinutes: row.durationMinutes,
    href: quizHref(hrefs.courseSlug, hrefs.lessonSlug),
  };
}

/** The outline SELECT's row shape (queries.selectOutlineRows). NULLable
 *  progress columns mean "no lesson_progress row for THIS participant". */
export type LessonOutlineRow = {
  id: string;
  slug: string;
  title: string;
  videoStatus: (typeof videoStatusEnum.enumValues)[number];
  /** Card S5-04: the READY video's stored duration — the sedang-dipelajari
   *  clock's denominator. */
  videoDurationSeconds: number | null;
  status: (typeof progressStatusEnum.enumValues)[number] | null;
  quizAttempted: boolean | null;
  /** NUMERIC as it leaves the driver — Number()'d below, shown when
   *  quizAttempted (card S3-01 §4.A outline score). */
  quizScorePercent: string | null;
  /** Card S5-04: the STORED verdict, never recomputed from the score. */
  quizIsPassed: boolean | null;
  videoLastPositionSeconds: number | null;
  /** NUMERIC leaves the driver as a string ('50.00') — Number()'d below. */
  videoWatchedPercent: string | null;
};

export type LessonOutlineItemDTO = {
  position: number;
  title: string;
  state: "kini" | "selesai" | "terbuka" | "terkunci";
  /** null for "terkunci" — the gate is server-side, the row is not a link. */
  href: string | null;
  /** The lesson-quiz score, FLOORED (card S3-02 §3 — never rounds up;
   *  same rule as the result screen's scorePercent), ONLY when the quiz
   *  was attempted (card S3-01 §4.A) — null everywhere else, including
   *  locked rows. */
  scorePercent: number | null;
};

export type LessonCourseDTO = {
  slug: string;
  title: string;
  lessonCount: number;
  completedLessonCount: number;
};

export type LessonPageDTO =
  | {
      state: "open";
      course: LessonCourseDTO;
      lesson: {
        id: string;
        title: string;
        position: number;
        content: unknown;
        /** resolvePlayback of the open lesson's video columns; null = no
         *  playable video (card S2-02 §3, replaces hasVideo). */
        playback: PlaybackDTO | null;
      };
      progress: {
        videoLastPositionSeconds: number;
        videoWatchedPercent: number;
      } | null;
      /** The quiz card (card S3-01 §4.A); null when the lesson has no quiz. */
      quiz: OpenQuizDTO | null;
      /** Card S5-02 §1: the Final Quiz href, TOP-LEVEL on the open state —
       *  non-null exactly when every lesson is COMPLETED and the course HAS
       *  a Final Quiz (the bottom bar's "Final Quiz" link). */
      finalQuizHref: string | null;
      /** Card S3-02 §5: the Final was already WORKED — the href's gate
       *  plus the STORED enrollment status having left IN_PROGRESS (the
       *  "nilai tersimpan" lesson, 19 Nov no. 2: the gladi-reset SQL
       *  pattern flips the status back to re-open the Final, so the
       *  status — never a recompute from attempts — is the source of
       *  truth). The bottom bar's label becomes "Hasil Final Quiz". */
      finalQuizDone: boolean;
      outline: LessonOutlineItemDTO[];
      prevHref: string | null;
      next:
        | { kind: "link"; href: string }
        | { kind: "terkunci"; position: number }
        | null;
    }
  | {
      state: "locked";
      course: LessonCourseDTO;
      lesson: { title: string; position: number };
      unlock: { position: number; href: string } | null;
      outline: LessonOutlineItemDTO[];
    }
  | {
      state: "not-enrolled";
      course: { id: string; title: string };
      lesson: { title: string; position: number };
    };

/** What the service hands toLessonPageDTO. `content` and `playback` are
 *  read ONLY when the state will be open (card §1 step 5, card S2-02 §3);
 *  the enrollment's absence alone decides not-enrolled, the gate alone
 *  decides locked vs open. */
export type LessonPageInput = {
  course: {
    id: string;
    slug: string;
    title: string;
    isSequential: boolean;
    /** Card S5-02 §1 — drives finalQuizHref on the open state. */
    finalQuizId: string | null;
  };
  /** Card S3-02 §5: `status` joins the id — the STORED course result
   *  drives finalQuizDone on the open state (the "nilai tersimpan"
   *  lesson, 19 Nov no. 2: read the stored status, never recompute it
   *  from attempts). */
  enrollment:
    | {
        id: string;
        status: (typeof enrollmentStatusEnum.enumValues)[number];
      }
    | undefined;
  outline: readonly LessonOutlineRow[];
  /** 0-based index into `outline`; the service has already resolved the
   *  lesson slug and answered 404 for a miss. */
  targetIndex: number;
  content: unknown;
  /** resolvePlayback over selectOpenLesson's row — null for every
   *  non-open state by construction (the query never runs). */
  playback: PlaybackDTO | null;
  /** selectOpenLessonQuiz's row — null for every non-open state AND for an
   *  open lesson without a quiz (the query runs only when open, V-06). */
  quizRow: OpenQuizRow | null;
};

/**
 * The lesson page DTO (card §1): one union member per page state, every
 * href through lessonHref, content/progress present ONLY on `open`.
 * Item-state priority: kini > selesai > terkunci > terbuka.
 */
export function toLessonPageDTO(input: LessonPageInput): LessonPageDTO {
  const { course, outline, targetIndex } = input;
  const target = outline[targetIndex];
  if (!target) {
    // The service resolves the slug before calling — a miss here is a
    // programming error, same stance as firstLessonSlugOf.
    throw new Error("progress serializer: lesson page without a target row");
  }
  const gateRows = outline.map((row) => ({
    quizAttempted: row.quizAttempted,
  }));
  const unlocked = (position: number) =>
    isLessonUnlocked(position, gateRows, course.isSequential);

  if (!input.enrollment) {
    return {
      state: "not-enrolled",
      course: { id: course.id, title: course.title },
      lesson: { title: target.title, position: targetIndex + 1 },
    };
  }

  const items: LessonOutlineItemDTO[] = outline.map((row, index) => {
    const position = index + 1;
    // Priority per the card: the lesson being viewed is always "kini"
    // (ring + aria-current = you are here), a COMPLETED lesson stays
    // "selesai" even if the gate would re-lock it, then the gate decides.
    const state: LessonOutlineItemDTO["state"] =
      index === targetIndex
        ? "kini"
        : row.status === "COMPLETED"
          ? "selesai"
          : unlocked(position)
            ? "terbuka"
            : "terkunci";
    return {
      position,
      title: row.title,
      state,
      href: state === "terkunci" ? null : lessonHref(course.slug, row.slug),
      scorePercent:
        row.quizAttempted === true
          ? Math.floor(Number(row.quizScorePercent ?? 0))
          : null,
    };
  });
  const courseDTO: LessonCourseDTO = {
    slug: course.slug,
    title: course.title,
    lessonCount: outline.length,
    completedLessonCount: outline.filter((row) => row.status === "COMPLETED")
      .length,
  };

  if (!unlocked(targetIndex + 1)) {
    const unlockPosition = firstOpenUnattempted(
      gateRows,
      course.isSequential,
    );
    return {
      state: "locked",
      course: courseDTO,
      lesson: { title: target.title, position: targetIndex + 1 },
      unlock:
        unlockPosition === null
          ? null
          : {
              position: unlockPosition,
              href: lessonHref(
                course.slug,
                outline[unlockPosition - 1]!.slug,
              ),
            },
      outline: items,
    };
  }

  const nextIndex = targetIndex + 1;
  let next: Extract<LessonPageDTO, { state: "open" }>["next"];
  if (nextIndex >= outline.length) {
    // Last lesson: the Final Quiz slot arrives with the quiz card.
    next = null;
  } else if (unlocked(nextIndex + 1)) {
    next = { kind: "link", href: lessonHref(course.slug, outline[nextIndex]!.slug) };
  } else {
    next = { kind: "terkunci", position: nextIndex + 1 };
  }

  // status is NULL exactly when the LEFT JOIN found no lesson_progress row
  // for this participant (every real row carries a status).
  const hasProgressRow = target.status !== null;

  const openFinalQuizHref =
    course.finalQuizId !== null && allLessonsCompleted(outline)
      ? finalQuizHref(course.slug)
      : null;

  return {
    state: "open",
    course: courseDTO,
    lesson: {
      id: target.id,
      title: target.title,
      position: targetIndex + 1,
      content: input.content,
      playback: input.playback,
    },
    progress: hasProgressRow
      ? {
          videoLastPositionSeconds: target.videoLastPositionSeconds ?? 0,
          videoWatchedPercent: Number(target.videoWatchedPercent ?? 0),
        }
      : null,
    quiz:
      input.quizRow !== null && input.quizRow !== undefined
        ? toOpenQuizDTO(input.quizRow, target, {
            courseSlug: course.slug,
            lessonSlug: target.slug,
          })
        : null,
    finalQuizHref: openFinalQuizHref,
    /** Card S3-02 §5: the Final was already worked — the href's gate plus
     *  the STORED enrollment status having left IN_PROGRESS (the "nilai
     *  tersimpan" lesson, 19 Nov no. 2: the gladi-reset SQL pattern flips
     *  the status back to re-open the Final, so status — not a probe of
     *  attempts — is the source of truth). */
    finalQuizDone:
      openFinalQuizHref !== null && input.enrollment.status !== "IN_PROGRESS",
    outline: items,
    prevHref:
      targetIndex > 0
        ? lessonHref(course.slug, outline[targetIndex - 1]!.slug)
        : null,
    next,
  };
}

/**
 * `/belajar/{courseSlug}/{lessonSlug}` — the ONE href builder for lesson
 * pages (card S5-01 §1; the Kam-12 lesson card reuses it through the
 * service).
 */
export function lessonHref(courseSlug: string, lessonSlug: string): string {
  return `/belajar/${courseSlug}/${lessonSlug}`;
}

function firstLessonSlugOf(row: {
  firstLessonSlug: string | null;
}): string {
  if (row.firstLessonSlug === null) {
    // Both dashboard SELECTs filter on "has at least one lesson" (and so
    // does the enroll transaction), so a null here means broken SQL, not a
    // user-facing case — fail loud instead of building a broken href.
    throw new Error("progress serializer: course row without a first lesson slug");
  }
  return row.firstLessonSlug;
}

/** PRG-06 badge: PASSED → lulus, COMPLETED → selesai; otherwise a course
 *  never opened (last_lesson_id NULL AND nothing completed) is
 *  belum-dimulai, the rest sedang-berjalan. Card S5-04: the param is the
 *  THREE columns the rule reads, so the dashboard's EnrolledRow and the
 *  progress page's enrollment+outline feed the SAME function — no second
 *  copy of the rule. */
function badgeOf(
  row: Pick<
    EnrolledRow,
    "enrollmentStatus" | "lastLessonId" | "completedLessonCount"
  >,
): EnrolledCourseDTO["badge"] {
  if (row.enrollmentStatus === "PASSED") return "lulus";
  if (row.enrollmentStatus === "COMPLETED") return "selesai";
  if (row.lastLessonId === null && row.completedLessonCount === 0) {
    return "belum-dimulai";
  }
  return "sedang-berjalan";
}

export function toLearnerCourseDTO(row: AvailableRow): LearnerCourseDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    levelLabel: COURSE_LEVEL_LABELS[row.level],
    summary: row.summary,
    estimatedMinutes: row.estimatedMinutes,
    lessonCount: row.lessonCount,
    startHref: lessonHref(row.slug, firstLessonSlugOf(row)),
  };
}

export function toEnrolledCourseDTO(row: EnrolledRow): EnrolledCourseDTO {
  // The action follows lastLessonSlug (owner review 11 Nov no. 5): a
  // stale last_lesson_id that no longer resolves inside this course falls
  // back to "mulai" at the first lesson.
  const lastSlug = row.lastLessonSlug;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    levelLabel: COURSE_LEVEL_LABELS[row.level],
    lessonCount: row.lessonCount,
    completedLessonCount: row.completedLessonCount,
    badge: badgeOf(row),
    action: {
      kind: lastSlug !== null ? "lanjutkan" : "mulai",
      href: lessonHref(row.slug, lastSlug ?? firstLessonSlugOf(row)),
    },
  };
}

// ------------------------------------------------- S5-04 serializers

/**
 * One Kursus Saya card (card S5-04 §1 service A): badge via the SHARED
 * badgeOf, then the per-badge fields — meta kind/date, the stored Nilai
 * Akhir (selesai/lulus only), the last lesson's title (sedang-berjalan
 * only), the estimated duration (belum-dimulai only) — every other
 * combination null no matter what the columns hold.
 */
export function toMyCourseDTO(row: MyCourseRow): MyCourseDTO {
  const badge = badgeOf(row);
  const isDone = badge === "selesai" || badge === "lulus";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    badge,
    lessonCount: row.lessonCount,
    completedLessonCount: row.completedLessonCount,
    meta: isDone
      ? { kind: "selesai", at: (row.completedAt ?? row.updatedAt).toISOString() }
      : badge === "belum-dimulai"
        ? { kind: "diikuti", at: row.enrolledAt.toISOString() }
        : { kind: "terakhir-dibuka", at: row.updatedAt.toISOString() },
    finalScorePercent:
      isDone && row.finalScorePercent !== null
        ? Math.round(Number(row.finalScorePercent))
        : null,
    lastLessonTitle: badge === "sedang-berjalan" ? row.lastLessonTitle : null,
    estimatedMinutes: badge === "belum-dimulai" ? row.estimatedMinutes : null,
    // The dashboard action rule: a stale last_lesson_id falls back to the
    // first lesson (the title above may be null for the same reason).
    continueHref: lessonHref(row.slug, row.lastLessonSlug ?? firstLessonSlugOf(row)),
    progressHref: `/belajar/${row.slug}`,
  };
}

/**
 * The course progress page's DTO (card S5-04 §1 service B): per-lesson
 * status through the ONE pure function (decision 3), the Final Quiz row
 * from the STORED enrollment status first (decision 4 — the S3-02
 * "nilai tersimpan" rule), and the ringkasan numbers from the RAW NUMERIC
 * scores so they agree with Nilai Saya, never with the floored display.
 */
export function toCourseProgressPageDTO(
  input: CourseProgressInput,
): CourseProgressPageDTO {
  const { course, enrollment, outline, finalQuiz } = input;
  const completedLessonCount = outline.filter(
    (row) => row.status === "COMPLETED",
  ).length;
  const graded = outline.filter(
    (row) => row.quizAttempted === true && row.quizScorePercent !== null,
  );
  const lessons: CourseProgressLessonDTO[] = outline.map((row, index) => {
    const position = index + 1;
    const status = courseLessonStatus(position, row, outline, course.isSequential);
    return {
      position,
      title: row.title,
      status,
      href: status === "terkunci" ? null : lessonHref(course.slug, row.slug),
      hasVideo: row.videoStatus === "READY",
      scorePercent:
        row.quizAttempted === true
          ? Math.floor(Number(row.quizScorePercent ?? 0))
          : null,
      isPassed: row.quizIsPassed,
      video:
        status === "sedang-dipelajari" &&
        row.videoStatus === "READY" &&
        row.videoDurationSeconds !== null &&
        row.videoDurationSeconds > 0
          ? {
              positionSeconds: Math.min(
                row.videoLastPositionSeconds ?? 0,
                row.videoDurationSeconds,
              ),
              durationSeconds: row.videoDurationSeconds,
            }
          : null,
    };
  });
  return {
    state: "progres",
    course: { id: course.id, title: course.title },
    badge: badgeOf({
      enrollmentStatus: enrollment.status,
      lastLessonId: enrollment.lastLessonId,
      completedLessonCount,
    }),
    lessonCount: outline.length,
    completedLessonCount,
    lastActivityAt: enrollment.updatedAt.toISOString(),
    lessons,
    final:
      course.finalQuizId !== null && finalQuiz !== null
        ? {
            status:
              enrollment.status !== "IN_PROGRESS"
                ? "selesai"
                : allLessonsCompleted(outline)
                  ? "terbuka"
                  : "terkunci",
            href: finalQuizHref(course.slug),
            questionCount: finalQuiz.questionCount,
            durationMinutes: finalQuiz.durationMinutes,
          }
        : null,
    lessonAveragePercent:
      graded.length > 0
        ? Math.round(
            graded.reduce(
              (total, row) => total + Number(row.quizScorePercent),
              0,
            ) / graded.length,
          )
        : null,
    gradedLessonCount: graded.length,
    hasFailedLesson: graded.some((row) => row.quizIsPassed === false),
    finalScorePercent:
      enrollment.status !== "IN_PROGRESS" &&
      enrollment.finalScorePercent !== null
        ? Math.round(Number(enrollment.finalScorePercent))
        : null,
  };
}
