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

import { db } from "@/db";
import { courses, enrollments, lessonProgress, lessons } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";

import type { AvailableRow, EnrolledRow } from "./serializer";

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
