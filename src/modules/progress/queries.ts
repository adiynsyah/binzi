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

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { db } from "@/db";
import {
  courses,
  enrollments,
  enrollmentStatusEnum,
  lessonProgress,
  lessons,
  progressStatusEnum,
  questions,
  quizAttempts,
  quizzes,
  videoStatusEnum,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors";

import type {
  AvailableRow,
  EnrolledRow,
  LessonOutlineRow,
  OpenQuizRow,
  PlaybackSourceRow,
} from "./serializer";

/**
 * Transaction executor (mirror of the quiz module's DbTx, spelled out
 * locally — this module imports no other module's files beyond the course
 * schema). The lesson-page reads run on `db` (pure GET) and inside the
 * open/video transactions on `tx` with the SAME functions.
 */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Same functions run on `db` for pure-GET reads and on `tx` inside the
 *  write transactions — card S3-01's quiz page passes `db` here too. */
export type DbOrTx = Db | DbTx;

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

/** The course lookup of step 1: PUBLISHED-only, by slug. Card S5-02 §1
 *  adds final_quiz_id — the lesson page serializer turns it into the Final
 *  Quiz href once every lesson is COMPLETED. */
export type LessonCourseRow = {
  id: string;
  slug: string;
  title: string;
  isSequential: boolean;
  finalQuizId: string | null;
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
      finalQuizId: courses.finalQuizId,
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
): Promise<{
  id: string;
  lastLessonId: string | null;
  /** Card S3-02 §5: the STORED course result — drives finalQuizDone (the
   *  "nilai tersimpan" lesson, 19 Nov no. 2: read the stored status, never
   *  recompute it from attempts). */
  status: (typeof enrollmentStatusEnum.enumValues)[number];
} | undefined> {
  const rows = await executor
    .select({
      id: enrollments.id,
      lastLessonId: enrollments.lastLessonId,
      status: enrollments.status,
    })
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
      quizScorePercent: lessonProgress.quizScorePercent,
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
 * The lesson document + its video-source columns — a SEPARATE statement
 * that the service runs ONLY when the page state is `open` (card §1 step
 * 5, card S2-02 §3, V-06: locked and not-enrolled never read the material
 * OR the video id, not just never show them).
 */
export async function selectOpenLesson(
  lessonId: string,
): Promise<(PlaybackSourceRow & { content: unknown }) | undefined> {
  const rows = await db
    .select({
      content: lessons.content,
      videoStatus: lessons.videoStatus,
      videoProvider: lessons.videoProvider,
      videoExternalId: lessons.videoExternalId,
      videoKey: lessons.videoKey,
      videoDurationSeconds: lessons.videoDurationSeconds,
    })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return rows[0];
}

/** The open/video transactions' first lookup: lesson + its PUBLISHED course.
 *  Card S3-01 extends the shape with lessons.quiz_id and courses.slug — the
 *  quiz context (loadLessonQuizContext) is built from the same single read,
 *  so the quiz flow can never disagree with the lesson gate about which
 *  course/lesson a lessonId belongs to. */
export type LessonGateLookup = {
  lesson: {
    id: string;
    quizId: string | null;
    videoStatus: (typeof videoStatusEnum.enumValues)[number];
    videoDurationSeconds: number | null;
  };
  course: {
    id: string;
    slug: string;
    isSequential: boolean;
    finalQuizId: string | null;
  };
};

export async function findLessonInPublishedCourse(
  executor: DbOrTx,
  lessonId: string,
): Promise<LessonGateLookup | undefined> {
  const rows = await executor
    .select({
      lessonId: lessons.id,
      quizId: lessons.quizId,
      videoStatus: lessons.videoStatus,
      videoDurationSeconds: lessons.videoDurationSeconds,
      courseId: courses.id,
      courseSlug: courses.slug,
      courseIsSequential: courses.isSequential,
      courseFinalQuizId: courses.finalQuizId,
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
      quizId: row.quizId,
      videoStatus: row.videoStatus,
      videoDurationSeconds: row.videoDurationSeconds,
    },
    course: {
      id: row.courseId,
      slug: row.courseSlug,
      isSequential: row.courseIsSequential,
      finalQuizId: row.courseFinalQuizId,
    },
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

// --------------------------------------------------------------------------
// Quiz materi (card S3-01). The attempt module OWNS quiz_attempts writes;
// this module only reads what the lesson page's quiz card needs, plus the
// two writes that land in lesson_progress at submit time.
// --------------------------------------------------------------------------

/**
 * The open lesson's quiz summary (card S3-01 §4.A) — read ONLY for an open
 * lesson, next to selectOpenLesson (V-06 pattern: a locked or not-enrolled
 * visit never reads the quiz of a lesson it cannot see). The attempt join
 * is the actor's live (reset_at NULL) row only; `attemptStatus` NULL means
 * "belum", IN_PROGRESS means "berjalan", a final status is unreachable here
 * for the card's one-attempt rule but reads as "belum" defensively.
 */
export async function selectOpenLessonQuiz(
  lessonId: string,
  actorId: string,
): Promise<OpenQuizRow | undefined> {
  const rows = await db
    .select({
      title: quizzes.title,
      durationMinutes: quizzes.durationMinutes,
      questionCount: sql<number>`(
        select count(*) from ${questions} as q where q.quiz_id = quizzes.id
      )`.mapWith(Number),
      attemptStatus: quizAttempts.status,
      quizAttempted: lessonProgress.quizAttempted,
    })
    .from(quizzes)
    .innerJoin(lessons, eq(lessons.quizId, quizzes.id))
    .leftJoin(
      quizAttempts,
      and(
        eq(quizAttempts.quizId, quizzes.id),
        eq(quizAttempts.userId, actorId),
        sql`${quizAttempts.resetAt} is null`,
      ),
    )
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.userId, actorId),
      ),
    )
    .where(eq(lessons.id, lessonId))
    .orderBy(desc(quizAttempts.attemptNumber))
    .limit(1);
  return rows[0];
}

/**
 * The video half of "Materi Selesai" (card S3-01 §1), read inside the submit
 * transaction: lessons.video_status + THIS participant's stored watched
 * percent. A missing lesson row answers `undefined` (the caller fails loud).
 */
export async function selectLessonVideoGate(
  executor: DbOrTx,
  actorId: string,
  lessonId: string,
): Promise<
  | {
      videoStatus: (typeof videoStatusEnum.enumValues)[number];
      videoWatchedPercent: string | null;
    }
  | undefined
> {
  const rows = await executor
    .select({
      videoStatus: lessons.videoStatus,
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
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return rows[0];
}

/**
 * The submit-time progress write (card S3-01 §1): quiz_attempted + the
 * score columns always; status/completed_at reach COMPLETED only when the
 * video requirement is already met (CRS-08 — the caller computes
 * `videoRequirementMet` from selectLessonVideoGate + isQuizEligible so this
 * query stays mechanical). The row may not exist yet (a quiz-first visit
 * never ran the open upsert) — the insert branch mirrors upsertLessonOpen,
 * and completed_at is only-if-null (coalesce) on the conflict branch.
 */
export async function upsertLessonQuizResult(
  tx: DbTx,
  input: {
    actorId: string;
    lessonId: string;
    enrollmentId: string;
    videoRequirementMet: boolean;
    scorePercent: number;
    isPassed: boolean;
    submittedAt: Date;
  },
): Promise<void> {
  await tx
    .insert(lessonProgress)
    .values({
      userId: input.actorId,
      lessonId: input.lessonId,
      enrollmentId: input.enrollmentId,
      status: input.videoRequirementMet ? "COMPLETED" : "IN_PROGRESS",
      firstAccessedAt: input.submittedAt,
      quizAttempted: true,
      quizScorePercent: input.scorePercent.toFixed(2),
      quizIsPassed: input.isPassed,
      quizSubmittedAt: input.submittedAt,
      completedAt: input.videoRequirementMet ? input.submittedAt : null,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        status: sql`case
          when ${lessonProgress.status} = 'COMPLETED' then ${lessonProgress.status}
          when excluded.status = 'COMPLETED' then 'COMPLETED'::progress_status
          when ${lessonProgress.status} = 'NOT_STARTED' then 'IN_PROGRESS'::progress_status
          else ${lessonProgress.status}
        end`,
        firstAccessedAt: sql`coalesce(${lessonProgress.firstAccessedAt}, excluded.first_accessed_at)`,
        quizAttempted: true,
        quizScorePercent: sql`excluded.quiz_score_percent`,
        quizIsPassed: sql`excluded.quiz_is_passed`,
        quizSubmittedAt: sql`excluded.quiz_submitted_at`,
        completedAt: sql`coalesce(${lessonProgress.completedAt}, excluded.completed_at)`,
      },
    });
}

// --------------------------------------------------------------------------
// Final Quiz (card S5-02). The attempt module still OWNS quiz_attempts; this
// module owns the course gate (all lessons COMPLETED) and the enrollment
// write that records Nilai Akhir at submit time.
// --------------------------------------------------------------------------

/**
 * The Final Quiz course lookup (card S5-02 §1): PUBLISHED-only, by id (the
 * start/submit transactions) or by slug (the pure-GET page), WITH a
 * final_quiz_id — every miss (unknown, unpublished, no Final Quiz) is the
 * SAME undefined, so a draft's or a quiz-less course's existence never
 * leaks (anti-IDOR shape). firstLessonSlug rides along for the
 * not-enrolled redirect.
 */
export async function findPublishedCourseWithFinalQuiz(
  executor: DbOrTx,
  target: { courseId: string } | { courseSlug: string },
): Promise<
  | {
      id: string;
      slug: string;
      title: string;
      finalQuizId: string;
      firstLessonSlug: string | null;
    }
  | undefined
> {
  const rows = await executor
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      finalQuizId: courses.finalQuizId,
      firstLessonSlug: firstLessonSlugSql,
    })
    .from(courses)
    .where(
      and(
        "courseId" in target
          ? eq(courses.id, target.courseId)
          : eq(courses.slug, target.courseSlug),
        eq(courses.status, "PUBLISHED"),
        sql`${courses.finalQuizId} is not null`,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || row.finalQuizId === null) return undefined;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    finalQuizId: row.finalQuizId,
    firstLessonSlug: row.firstLessonSlug,
  };
}

/**
 * Every lesson's quiz score of the course for THIS participant (card S5-02
 * §1): the submit transaction re-reads them to compute Nilai Akhir. Rows,
 * not an aggregate — avg() would silently skip a NULL score, and the caller
 * fails loud on one instead (a valid Final attempt implies every lesson
 * COMPLETED with a score). Typed builder on purpose: no interpolated column
 * inside sql`` (the bare-name pitfall in the file header cannot occur).
 */
export async function selectCourseLessonScoreRows(
  executor: DbOrTx,
  actorId: string,
  courseId: string,
): Promise<{ lessonId: string; scorePercent: string | null }[]> {
  return executor
    .select({
      lessonId: lessons.id,
      scorePercent: lessonProgress.quizScorePercent,
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
 * The Final Quiz's enrollment write (card S5-02 §1): final_score_percent +
 * status (PASSED when the final attempt passed, else COMPLETED) +
 * completed_at only-if-null. The WHERE carries BOTH the id and the actor's
 * user_id (anti-IDOR in the write, matching every read). Typed on purpose —
 * updated_at moves with the result (PRG-02, course activity).
 */
export async function updateEnrollmentFinalResult(
  tx: DbTx,
  input: {
    enrollmentId: string;
    actorId: string;
    /** scorePercent.toFixed(2) — NUMERIC(5,2) takes a string. */
    finalScorePercent: string;
    status: "COMPLETED" | "PASSED";
    completedAt: Date;
  },
): Promise<void> {
  await tx
    .update(enrollments)
    .set({
      status: input.status,
      finalScorePercent: input.finalScorePercent,
      // A raw Date inside a drizzle `sql` fragment skips the column mapper:
      // postgres.js serializes it with the locale toString() and the wire
      // query fails (PGlite accepts it, so only e2e catches this). Bind an
      // ISO string with an explicit cast instead.
      completedAt: sql`coalesce(${enrollments.completedAt}, ${input.completedAt.toISOString()}::timestamptz)`,
    })
    .where(
      and(
        eq(enrollments.id, input.enrollmentId),
        eq(enrollments.userId, input.actorId),
      ),
    );
}

/**
 * The Final result screen's display read (card S5-02 §2): the STORED Nilai
 * Akhir + the course status — read AFTER submit, never written here.
 */
export async function selectEnrollmentFinalResult(
  executor: DbOrTx,
  actorId: string,
  courseId: string,
): Promise<
  | {
      finalScorePercent: string | null;
      status: (typeof enrollmentStatusEnum.enumValues)[number];
    }
  | undefined
> {
  const rows = await executor
    .select({
      finalScorePercent: enrollments.finalScorePercent,
      status: enrollments.status,
    })
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

// --------------------------------------------------------------------------
// Nilai Saya (card S5-03 §1). Pure reads — the grades page never writes.
// The row shapes live HERE (not in serializer.ts) because the attempt
// module consumes them only through loadGradeCourses in service.ts.
// --------------------------------------------------------------------------

/** The grades enrollment SELECT's row shape (card S5-03 §1). */
export type GradeEnrollmentRow = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  isSequential: boolean;
  finalQuizId: string | null;
  enrollmentStatus: (typeof enrollmentStatusEnum.enumValues)[number];
  /** NUMERIC leaves the driver as a string — rounded by the attempt DTO. */
  finalScorePercent: string | null;
  completedAt: Date | null;
  updatedAt: Date;
};

/**
 * The actor's PUBLISHED, lesson-bearing enrollments for the grades page
 * (card S5-03 §1): `enrolled_at asc, courses.id asc` — the TRANSCRIPT order,
 * stable unlike the dashboard's activity order. hasLessonsSql keeps the
 * same "no lessons" shape out as both dashboard lists.
 */
export async function selectGradeEnrollments(
  executor: DbOrTx,
  actorId: string,
): Promise<GradeEnrollmentRow[]> {
  return executor
    .select({
      courseId: courses.id,
      courseSlug: courses.slug,
      courseTitle: courses.title,
      isSequential: courses.isSequential,
      finalQuizId: courses.finalQuizId,
      enrollmentStatus: enrollments.status,
      finalScorePercent: enrollments.finalScorePercent,
      completedAt: enrollments.completedAt,
      updatedAt: enrollments.updatedAt,
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
    .orderBy(asc(enrollments.enrolledAt), asc(courses.id));
}

/** One lessons+progress row of the grades SELECT (card S5-03 §1). NULLable
 *  progress columns mean "no lesson_progress row for THIS participant". */
export type GradeLessonRow = {
  lessonId: string;
  courseId: string;
  lessonSlug: string;
  lessonTitle: string;
  quizId: string | null;
  status: (typeof progressStatusEnum.enumValues)[number] | null;
  quizAttempted: boolean | null;
  /** NUMERIC as it leaves the driver — floored by the attempt DTO. */
  quizScorePercent: string | null;
  quizIsPassed: boolean | null;
  quizSubmittedAt: Date | null;
};

/**
 * EVERY course's lesson rows of the grades page in ONE query (card S5-03
 * §1): the `user_id = actor` inside the LEFT JOIN's ON clause is what keeps
 * other participants' progress out (the selectOutlineRows rule); the
 * `course_id, order_index asc, id asc` order is the outline's, so
 * "Quiz Materi {n}" here names the same lesson as the lesson page.
 */
export async function selectGradeLessonRows(
  executor: DbOrTx,
  actorId: string,
  courseIds: string[],
): Promise<GradeLessonRow[]> {
  return executor
    .select({
      lessonId: lessons.id,
      courseId: lessons.courseId,
      lessonSlug: lessons.slug,
      lessonTitle: lessons.title,
      quizId: lessons.quizId,
      status: lessonProgress.status,
      quizAttempted: lessonProgress.quizAttempted,
      quizScorePercent: lessonProgress.quizScorePercent,
      quizIsPassed: lessonProgress.quizIsPassed,
      quizSubmittedAt: lessonProgress.quizSubmittedAt,
    })
    .from(lessons)
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.userId, actorId),
      ),
    )
    .where(inArray(lessons.courseId, courseIds))
    .orderBy(asc(lessons.courseId), asc(lessons.orderIndex), asc(lessons.id));
}
