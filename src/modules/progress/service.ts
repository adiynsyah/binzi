// Service layer for the progress module (cards S5-01 + S2-01) — the ONLY
// surface other modules may import (src/modules/README.md). Guards run
// role FIRST, then input (guard order); everything returned is an
// explicit DTO.
import type { SessionUser } from "@/lib/rbac";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { UUID_PATTERN } from "@/modules/course/schema";
import { db } from "@/db";

import type { VideoProgressInput } from "./schema";
import { assertMemberRole, isLessonUnlocked } from "./policy";
import {
  enrollUserInCourse,
  findLessonInPublishedCourse,
  selectAvailableCourses,
  selectEnrolledCourses,
  selectEnrollmentForCourse,
  selectLessonContent,
  selectOutlineRows,
  selectPublishedCourseBySlug,
  setEnrollmentLastLesson,
  upsertLessonOpen,
  upsertLessonVideoProgress,
  type DbTx,
  type LessonGateLookup,
} from "./queries";
import {
  lessonHref,
  toEnrolledCourseDTO,
  toLearnerCourseDTO,
  toLessonPageDTO,
  type EnrollResultDTO,
  type LearnerCourseDTO,
  type EnrolledCourseDTO,
  type LearnerDashboardDTO,
  type LessonCourseDTO,
  type LessonOutlineItemDTO,
  type LessonOutlineRow,
  type LessonPageDTO,
  type VideoProgressResultDTO,
} from "./serializer";

export { lessonHref };
export type {
  EnrollResultDTO,
  LearnerCourseDTO,
  EnrolledCourseDTO,
  LearnerDashboardDTO,
  LessonPageDTO,
  LessonOutlineItemDTO,
  LessonCourseDTO,
  VideoProgressResultDTO,
};

/** The member dashboard (card §1): two lists, explicitly serialized —
 *  description/content columns never even leave the database. */
export async function getLearnerDashboard(
  actor: SessionUser,
): Promise<LearnerDashboardDTO> {
  assertMemberRole(actor);
  const [enrolledRows, availableRows] = await Promise.all([
    selectEnrolledCourses(actor.id),
    selectAvailableCourses(actor.id),
  ]);
  return {
    enrolled: enrolledRows.map(toEnrolledCourseDTO),
    available: availableRows.map(toLearnerCourseDTO),
  };
}

/**
 * Enroll the actor in a course (card §1 step 2, owner decision 10 Nov #1).
 * Role is checked before the id is even parsed; a non-UUID misses the same
 * 404 as an unknown/PUBLISHED-only miss so ids cannot be probed.
 */
export async function enrollInCourse(
  actor: SessionUser,
  courseId: string,
): Promise<{ created: boolean; data: EnrollResultDTO }> {
  assertMemberRole(actor);
  if (!UUID_PATTERN.test(courseId)) {
    throw new NotFoundError("Kursus tidak ditemukan.");
  }
  const result = await enrollUserInCourse({
    actorId: actor.id,
    courseId,
  });
  return {
    created: result.created,
    data: {
      courseId,
      // A returning participant continues at their last lesson.
      startHref: lessonHref(
        result.courseSlug,
        result.lastLessonSlug ?? result.firstLessonSlug,
      ),
    },
  };
}

// ------------------------------------------------------------- S2-01

/** Everything the open/video transactions need after the gate checks. */
type UnlockedLessonContext = {
  enrollmentId: string;
  outline: LessonOutlineRow[];
  targetIndex: number;
  course: LessonGateLookup["course"];
  lesson: LessonGateLookup["lesson"];
};

/**
 * Steps 1–3 of the open/video transactions (card §2/§3), ONE helper so the
 * two endpoints can never disagree about the gate: PUBLISHED course → the
 * actor's enrollment → outline + `isLessonUnlocked` over the SAME rows the
 * page reads. Every miss (unknown/unpublished lesson, not enrolled, not
 * this course's lesson) is the SAME 404; a locked lesson is 409.
 */
async function loadUnlockedLessonContext(
  tx: DbTx,
  actorId: string,
  lessonId: string,
): Promise<UnlockedLessonContext> {
  const found = await findLessonInPublishedCourse(tx, lessonId);
  if (!found) {
    throw new NotFoundError("Materi tidak ditemukan.");
  }
  const enrollment = await selectEnrollmentForCourse(
    tx,
    actorId,
    found.course.id,
  );
  if (!enrollment) {
    throw new NotFoundError("Materi tidak ditemukan.");
  }
  const outline = await selectOutlineRows(tx, actorId, found.course.id);
  const targetIndex = outline.findIndex((row) => row.id === lessonId);
  if (targetIndex === -1) {
    throw new NotFoundError("Materi tidak ditemukan.");
  }
  const gateRows = outline.map((row) => ({ quizAttempted: row.quizAttempted }));
  if (!isLessonUnlocked(targetIndex + 1, gateRows, found.course.isSequential)) {
    throw new ConflictError("Materi ini masih terkunci.");
  }
  return {
    enrollmentId: enrollment.id,
    outline,
    targetIndex,
    course: found.course,
    lesson: found.lesson,
  };
}

/**
 * The lesson page (card S2-01 §1) — a pure GET: three SELECTs (course,
 * enrollment, outline) and a FOURTH for the document, run only when the
 * state is `open` (V-06: the material of a locked lesson is never read,
 * not just never shown).
 */
export async function getLessonPage(
  actor: SessionUser,
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonPageDTO> {
  assertMemberRole(actor);
  const course = await selectPublishedCourseBySlug(courseSlug);
  if (!course) {
    throw new NotFoundError("Kursus tidak ditemukan.");
  }
  const enrollment = await selectEnrollmentForCourse(db, actor.id, course.id);
  const outline = await selectOutlineRows(db, actor.id, course.id);
  const targetIndex = outline.findIndex((row) => row.slug === lessonSlug);
  if (targetIndex === -1) {
    throw new NotFoundError("Materi tidak ditemukan.");
  }
  const gateRows = outline.map((row) => ({ quizAttempted: row.quizAttempted }));
  const willOpen =
    enrollment !== undefined &&
    isLessonUnlocked(targetIndex + 1, gateRows, course.isSequential);
  const contentRow = willOpen
    ? await selectLessonContent(outline[targetIndex]!.id)
    : undefined;
  return toLessonPageDTO({
    course,
    enrollment,
    outline,
    targetIndex,
    content: contentRow?.content ?? null,
  });
}

/**
 * "Materi dibuka" (card §2): upsert lesson_progress + last_lesson_id, one
 * transaction. enrollments.updated_at moves (typed update, PRG-02);
 * courses.updated_at never does (the table is not touched at all).
 */
export async function openLesson(
  actor: SessionUser,
  lessonId: string,
): Promise<void> {
  assertMemberRole(actor);
  // Same 404 as every other miss — ids cannot be probed.
  if (!UUID_PATTERN.test(lessonId)) {
    throw new NotFoundError("Materi tidak ditemukan.");
  }
  await db.transaction(async (tx) => {
    const context = await loadUnlockedLessonContext(tx, actor.id, lessonId);
    await upsertLessonOpen(tx, {
      actorId: actor.id,
      lessonId,
      enrollmentId: context.enrollmentId,
    });
    await setEnrollmentLastLesson(tx, context.enrollmentId, lessonId);
  });
}

/**
 * Save the video position (card §3, permanent groundwork for the S2-02
 * player): watched percent is the FARTHEST position ever (greatest, PRG
 * demo decision) against the stored duration when one exists.
 */
export async function recordVideoProgress(
  actor: SessionUser,
  input: VideoProgressInput,
): Promise<VideoProgressResultDTO> {
  assertMemberRole(actor);
  return db.transaction(async (tx) => {
    const context = await loadUnlockedLessonContext(
      tx,
      actor.id,
      input.lessonId,
    );
    if (context.lesson.videoStatus !== "READY") {
      throw new ConflictError("Materi ini tidak punya video.");
    }
    // The column has no CHECK and is nullable: only a stored duration > 0
    // wins over the player's own report (0 must not divide).
    const storedDuration = context.lesson.videoDurationSeconds;
    const duration =
      storedDuration !== null && storedDuration > 0
        ? storedDuration
        : input.durationSeconds;
    const watchedPercent = Math.min(
      100,
      Math.round((input.positionSeconds / duration) * 10000) / 100,
    );
    const stored = await upsertLessonVideoProgress(tx, {
      actorId: actor.id,
      lessonId: input.lessonId,
      enrollmentId: context.enrollmentId,
      positionSeconds: input.positionSeconds,
      watchedPercent,
    });
    await setEnrollmentLastLesson(tx, context.enrollmentId, input.lessonId);
    return {
      positionSeconds: stored.videoLastPositionSeconds,
      watchedPercent: Number(stored.videoWatchedPercent),
    };
  });
}
