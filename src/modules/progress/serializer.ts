// Explicit serialization for the progress module (card S5-01 §1,
// card S2-01 §1; PRD §12.6 V-01/V-05).
//
// Module-internal: consumers outside the module get the DTO types
// re-exported from service.ts. Pure on purpose — only type imports from
// the db schema plus the course module's SCHEMA file (allowed across
// modules) — so the serializer tests run without a database.
//
// Every function builds a fresh object from an explicit allowlist, so a
// column not listed (description, progressPercent, lastLessonId, …) can
// never leak even if a future query starts selecting it.
import type {
  enrollmentStatusEnum,
  progressStatusEnum,
  videoStatusEnum,
} from "@/db/schema";
import { COURSE_LEVEL_LABELS, type CourseLevel } from "@/modules/course/schema";

import { firstOpenUnattempted, isLessonUnlocked } from "./policy";

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

/** The outline SELECT's row shape (queries.selectOutlineRows). NULLable
 *  progress columns mean "no lesson_progress row for THIS participant". */
export type LessonOutlineRow = {
  id: string;
  slug: string;
  title: string;
  videoStatus: (typeof videoStatusEnum.enumValues)[number];
  status: (typeof progressStatusEnum.enumValues)[number] | null;
  quizAttempted: boolean | null;
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
        /** video_status = 'READY'; S2-02 replaces this with PlaybackDTO. */
        hasVideo: boolean;
      };
      progress: {
        videoLastPositionSeconds: number;
        videoWatchedPercent: number;
      } | null;
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

/** What the service hands toLessonPageDTO. `content` is read ONLY when the
 *  state will be open (card §1 step 5); the enrollment's absence alone
 *  decides not-enrolled, the gate alone decides locked vs open. */
export type LessonPageInput = {
  course: { id: string; slug: string; title: string; isSequential: boolean };
  enrollment: { id: string } | undefined;
  outline: readonly LessonOutlineRow[];
  /** 0-based index into `outline`; the service has already resolved the
   *  lesson slug and answered 404 for a miss. */
  targetIndex: number;
  content: unknown;
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
      hasVideo: target.videoStatus === "READY",
    },
    progress: hasProgressRow
      ? {
          videoLastPositionSeconds: target.videoLastPositionSeconds ?? 0,
          videoWatchedPercent: Number(target.videoWatchedPercent ?? 0),
        }
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
