// Explicit serialization for the progress module (card S5-01 §1,
// PRD §12.6 V-01/V-05).
//
// Module-internal: consumers outside the module get the DTO types
// re-exported from service.ts. Pure on purpose — only type imports from
// the db schema plus the course module's SCHEMA file (allowed across
// modules) — so the serializer tests run without a database.
//
// Every function builds a fresh object from an explicit allowlist, so a
// column not listed (description, progressPercent, lastLessonId, …) can
// never leak even if a future query starts selecting it.
import type { enrollmentStatusEnum } from "@/db/schema";
import { COURSE_LEVEL_LABELS, type CourseLevel } from "@/modules/course/schema";

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
