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
  firstOpenUnattempted,
  isLessonUnlocked,
  isQuizEligible,
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
  status: (typeof progressStatusEnum.enumValues)[number] | null;
  quizAttempted: boolean | null;
  /** NUMERIC as it leaves the driver — Number()'d below, shown when
   *  quizAttempted (card S3-01 §4.A outline score). */
  quizScorePercent: string | null;
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
  /** The lesson-quiz score, rounded, ONLY when the quiz was attempted
   *  (card S3-01 §4.A) — null everywhere else, including locked rows. */
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
  enrollment: { id: string } | undefined;
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
          ? Math.round(Number(row.quizScorePercent ?? 0))
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
    finalQuizHref:
      course.finalQuizId !== null && allLessonsCompleted(outline)
        ? finalQuizHref(course.slug)
        : null,
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
 *  belum-dimulai, the rest sedang-berjalan. */
function badgeOf(row: EnrolledRow): EnrolledCourseDTO["badge"] {
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
