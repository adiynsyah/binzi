// Database access for the progress domain (card S5-01 §1).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
//
// The module reads the courses/lessons/enrollments/lesson_progress TABLES
// directly (the lesson-module pattern): importing the course or lesson
// MODULE would drag its service surface in for what is plain SQL here.
// The only cross-module import is the course module's schema FILE, which
// the boundary explicitly allows.
//
// OUTER TABLE REFERENCES ARE HAND-WRITTEN in every sql`` subquery below
// (PR no. 129 finding, reproduced in the card): drizzle 0.45.3 renders a
// Column interpolated into a sql`` template by its BARE name in a
// single-table SELECT, so `${lessons.courseId} = ${courses.id}` renders
// "course_id" = "id" and Postgres binds BOTH sides to the subquery's own
// FROM — the count is silently wrong. Alias the subquery table, qualify
// the outer name by hand, in BOTH dashboard SELECTs (join today or not).
import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { db } from "@/db";
import {
  courses,
  enrollments,
  lessonProgress,
  lessons,
  videoStatusEnum,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors";

import type { AvailableRow, EnrolledRow, LessonOutlineRow } from "./serializer";

/**
 * Transaction executor (mirror of the quiz module's DbTx, spelled out
 * locally — this module imports no other module's files beyond the course
 * schema). The lesson-page reads run on `db` (pure GET) and inside the
 * open/video transactions on `tx` with the SAME functions.
 */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbOrTx = Db | DbTx;

/**
 * The FIRST lesson of `courses.id` — ONE fragment shared by the two
 * dashboard SELECTs and the enroll transaction (owner review 11 Nov no. 6);
 * card S2-01 (lesson page, Kam 12) reuses it inside this module.
 * order_index is NOT unique (uniqueness is (course_id, slug)), so the id
 * tie-break keeps "first" deterministic on a shared minimum.
 */
export const firstLessonSlugSql = sql<string | null>`
  (
    select fst.slug from ${lessons} as fst
    where fst.course_id = courses.id
    order by fst.order_index asc, fst.id asc
    limit 1
  )
`;

/** Lesson count per course — same hand-qualified outer reference as above. */
const lessonCountSql = sql<number>`
  (
    select count(*) from ${lessons} as counted
    where counted.course_id = courses.id
  )
`.mapWith(Number);

/** Completed lesson_progress rows of THIS enrollment. */
const completedLessonCountSql = sql<number>`
  (
    select count(*) from ${lessonProgress} as done
    where done.enrollment_id = enrollments.id and done.status = 'COMPLETED'
  )
`.mapWith(Number);

/** "Has at least one lesson" — applied to BOTH lists (owner review 11 Nov
 *  no. 5) so a course without lessons never reaches the serializer, whose
 *  null firstLessonSlug is a programming error. */
const hasLessonsSql = sql`exists (
  select 1 from ${lessons} as counted where counted.course_id = courses.id
)`;

/** "Not yet enrolled by this actor" (parameterized). */
const notEnrolledBySql = (actorId: string) => sql`not exists (
  select 1 from ${enrollments} as en
  where en.user_id = ${actorId} and en.course_id = courses.id
)`;

/** The `enrolled` list: the actor's PUBLISHED courses, newest activity
 *  first (the enrollments_user_updated_idx order), id as the tie-break. */
export async function selectEnrolledCourses(
  actorId: string,
): Promise<EnrolledRow[]> {
  return db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      level: courses.level,
      enrollmentStatus: enrollments.status,
      lastLessonId: enrollments.lastLessonId,
      lessonCount: lessonCountSql,
      completedLessonCount: completedLessonCountSql,
      firstLessonSlug: firstLessonSlugSql,
      lastLessonSlug: sql<string | null>`
        (
          select lst.slug from ${lessons} as lst
          where lst.id = enrollments.last_lesson_id
            and lst.course_id = courses.id
        )
      `,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(enrollments.userId, actorId),
        eq(courses.status, "PUBLISHED"),
        hasLessonsSql,
      ),
    )
    .orderBy(desc(enrollments.updatedAt), asc(courses.id));
}

/** The `available` list: PUBLISHED, with lessons, not yet enrolled —
 *  newest publication first, id as the tie-break. */
export async function selectAvailableCourses(
  actorId: string,
): Promise<AvailableRow[]> {
  return db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      level: courses.level,
      summary: courses.summary,
      estimatedMinutes: courses.estimatedMinutes,
      lessonCount: lessonCountSql,
      firstLessonSlug: firstLessonSlugSql,
    })
    .from(courses)
    .where(
      and(
        eq(courses.status, "PUBLISHED"),
        hasLessonsSql,
        notEnrolledBySql(actorId),
      ),
    )
    .orderBy(desc(courses.publishedAt), asc(courses.id));
}

/**
 * Implicit enrollment behind "Mulai materi 1" (owner decision 10 Nov #1),
 * ONE transaction (card §1 step 2):
 *   1. read the PUBLISHED course + its first lesson slug — every miss
 *      (unknown id, DRAFT/IN_REVIEW/ARCHIVED, no lessons) is the SAME 404,
 *      so a draft's existence never leaks (anti-IDOR shape);
 *   2. `insert … on conflict do nothing` — the UNIQUE(user_id, course_id)
 *      constraint is the guard, never a pre-check (races end in one row);
 *   3. counter +1 only on a NEW row, and via RAW SQL: drizzle's typed
 *      update() also stamps updated_at through $onUpdate, which would
 *      bubble the course to the top of the CMS "terakhir diubah" list on
 *      every enrollment (owner review 11 Nov no. 2);
 *   4. an EXISTING enrollment returns its last-lesson slug so a returning
 *      participant is taken to where they left off.
 */
export async function enrollUserInCourse(input: {
  actorId: string;
  courseId: string;
}): Promise<{
  created: boolean;
  courseSlug: string;
  firstLessonSlug: string;
  lastLessonSlug: string | null;
}> {
  return db.transaction(async (tx) => {
    const courseRows = await tx
      .select({
        id: courses.id,
        slug: courses.slug,
        firstLessonSlug: firstLessonSlugSql,
      })
      .from(courses)
      .where(
        and(
          eq(courses.id, input.courseId),
          eq(courses.status, "PUBLISHED"),
          hasLessonsSql,
        ),
      )
      .limit(1);
    const course = courseRows[0];
    if (!course || course.firstLessonSlug === null) {
      throw new NotFoundError("Kursus tidak ditemukan.");
    }

    // Conflict target by columns = the enrollments_user_course_unique
    // constraint's own columns (the typed builder takes columns, not an
    // `on constraint` fragment — same unique index either way).
    const inserted = await tx
      .insert(enrollments)
      .values({ userId: input.actorId, courseId: input.courseId })
      .onConflictDoNothing({
        target: [enrollments.userId, enrollments.courseId],
      })
      .returning({ id: enrollments.id });
    const created = inserted.length === 1;

    let lastLessonSlug: string | null = null;
    if (created) {
      await tx.execute(
        sql`update courses set enrollment_count = enrollment_count + 1 where id = ${input.courseId}`,
      );
    } else {
      const existing = await tx
        .select({ slug: lessons.slug })
        .from(enrollments)
        .innerJoin(lessons, eq(enrollments.lastLessonId, lessons.id))
        .where(
          and(
            eq(enrollments.userId, input.actorId),
            eq(enrollments.courseId, input.courseId),
            eq(lessons.courseId, input.courseId),
          ),
        )
        .limit(1);
      lastLessonSlug = existing[0]?.slug ?? null;
    }

    return {
      created,
      courseSlug: course.slug,
      firstLessonSlug: course.firstLessonSlug,
      lastLessonSlug,
    };
  });
}

// --------------------------------------------------------------------------
// Lesson page + gate (card S2-01). Every read below runs on `db` for the
// pure GET page and on `tx` inside the open/video transactions — same SQL,
// so the page and the writes can never disagree about the gate.
// --------------------------------------------------------------------------

/** The course lookup of step 1: PUBLISHED-only, by slug. */
export type LessonCourseRow = {
  id: string;
  slug: string;
  title: string;
  isSequential: boolean;
};

export async function selectPublishedCourseBySlug(
  courseSlug: string,
): Promise<LessonCourseRow | undefined> {
  const rows = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      isSequential: courses.isSequential,
    })
    .from(courses)
    .where(and(eq(courses.slug, courseSlug), eq(courses.status, "PUBLISHED")))
    .limit(1);
  return rows[0];
}

/** The actor's enrollment row for the course (card step 2). */
export async function selectEnrollmentForCourse(
  executor: DbOrTx,
  actorId: string,
  courseId: string,
): Promise<{ id: string; lastLessonId: string | null } | undefined> {
  const rows = await executor
    .select({ id: enrollments.id, lastLessonId: enrollments.lastLessonId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, actorId),
        eq(enrollments.courseId, courseId),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * The course outline with THIS participant's progress (card step 3):
 * `order_index asc, id asc` — the exact order of firstLessonSlugSql, so
 * "Materi 1" here and "Mulai materi 1" on the dashboard name the same
 * lesson. The `user_id` inside the ON clause is what keeps other
 * participants' rows out (without it every lesson with progress
 * duplicates).
 */
export async function selectOutlineRows(
  executor: DbOrTx,
  actorId: string,
  courseId: string,
): Promise<LessonOutlineRow[]> {
  return executor
    .select({
      id: lessons.id,
      slug: lessons.slug,
      title: lessons.title,
      videoStatus: lessons.videoStatus,
      status: lessonProgress.status,
      quizAttempted: lessonProgress.quizAttempted,
      videoLastPositionSeconds: lessonProgress.videoLastPositionSeconds,
      videoWatchedPercent: lessonProgress.videoWatchedPercent,
    })
    .from(lessons)
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.userId, actorId),
      ),
    )
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.orderIndex), asc(lessons.id));
}

/**
 * The lesson document — a SEPARATE statement that the service runs ONLY
 * when the page state is `open` (card §1 step 5, V-06: locked and
 * not-enrolled never read the material, not just never show it).
 */
export async function selectLessonContent(
  lessonId: string,
): Promise<{ content: unknown } | undefined> {
  const rows = await db
    .select({ content: lessons.content })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return rows[0];
}

/** The open/video transactions' first lookup: lesson + its PUBLISHED course. */
export type LessonGateLookup = {
  lesson: {
    id: string;
    videoStatus: (typeof videoStatusEnum.enumValues)[number];
    videoDurationSeconds: number | null;
  };
  course: { id: string; isSequential: boolean };
};

export async function findLessonInPublishedCourse(
  executor: DbOrTx,
  lessonId: string,
): Promise<LessonGateLookup | undefined> {
  const rows = await executor
    .select({
      lessonId: lessons.id,
      videoStatus: lessons.videoStatus,
      videoDurationSeconds: lessons.videoDurationSeconds,
      courseId: courses.id,
      courseIsSequential: courses.isSequential,
    })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(and(eq(lessons.id, lessonId), eq(courses.status, "PUBLISHED")))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return {
    lesson: {
      id: row.lessonId,
      videoStatus: row.videoStatus,
      videoDurationSeconds: row.videoDurationSeconds,
    },
    course: { id: row.courseId, isSequential: row.courseIsSequential },
  };
}

/**
 * "Materi dibuka" upsert (card §2 step 4 — the exact shape the card
 * verified on PGlite): status never leaves COMPLETED, first_accessed_at is
 * never overwritten. Drizzle stamps updated_at in the conflict branch via
 * $onUpdate — intended.
 */
export async function upsertLessonOpen(
  tx: DbTx,
  input: { actorId: string; lessonId: string; enrollmentId: string },
): Promise<void> {
  await tx
    .insert(lessonProgress)
    .values({
      userId: input.actorId,
      lessonId: input.lessonId,
      enrollmentId: input.enrollmentId,
      status: "IN_PROGRESS",
      firstAccessedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        status: sql`case when ${lessonProgress.status} = 'NOT_STARTED' then 'IN_PROGRESS'::progress_status else ${lessonProgress.status} end`,
        firstAccessedAt: sql`coalesce(${lessonProgress.firstAccessedAt}, excluded.first_accessed_at)`,
      },
    });
}

/**
 * PRG-02: enrollments.updated_at MUST move on every open (the "Kursus
 * saya" order), while courses.updated_at is never touched (S5-01 lesson).
 * The typed update is what stamps it — keep it typed.
 */
export async function setEnrollmentLastLesson(
  tx: DbTx,
  enrollmentId: string,
  lessonId: string,
): Promise<void> {
  await tx
    .update(enrollments)
    .set({ lastLessonId: lessonId })
    .where(eq(enrollments.id, enrollmentId));
}

/**
 * Video-position upsert (card §3 step 3): position follows the player,
 * watched percent only ever grows (greatest) — the farthest position ever,
 * accepted for the demo. Returns the STORED row, not the input.
 */
export async function upsertLessonVideoProgress(
  tx: DbTx,
  input: {
    actorId: string;
    lessonId: string;
    enrollmentId: string;
    positionSeconds: number;
    watchedPercent: number;
  },
): Promise<{ videoLastPositionSeconds: number; videoWatchedPercent: string }> {
  const rows = await tx
    .insert(lessonProgress)
    .values({
      userId: input.actorId,
      lessonId: input.lessonId,
      enrollmentId: input.enrollmentId,
      status: "IN_PROGRESS",
      firstAccessedAt: new Date(),
      videoLastPositionSeconds: input.positionSeconds,
      videoWatchedPercent: input.watchedPercent.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        status: sql`case when ${lessonProgress.status} = 'NOT_STARTED' then 'IN_PROGRESS'::progress_status else ${lessonProgress.status} end`,
        firstAccessedAt: sql`coalesce(${lessonProgress.firstAccessedAt}, excluded.first_accessed_at)`,
        videoLastPositionSeconds: sql`excluded.video_last_position_seconds`,
        videoWatchedPercent: sql`greatest(${lessonProgress.videoWatchedPercent}, excluded.video_watched_percent)`,
      },
    })
    .returning({
      videoLastPositionSeconds: lessonProgress.videoLastPositionSeconds,
      videoWatchedPercent: lessonProgress.videoWatchedPercent,
    });
  const row = rows[0];
  if (!row) {
    throw new Error("progress queries: video upsert returned no row");
  }
  return row;
}
