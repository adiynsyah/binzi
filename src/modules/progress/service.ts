// Service layer for the progress module (cards S5-01 + S2-01) — the ONLY
// surface other modules may import (src/modules/README.md). Guards run
// role FIRST, then input (guard order); everything returned is an
// explicit DTO.
import type { SessionUser } from "@/lib/rbac";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { UUID_PATTERN } from "@/modules/course/schema";
import { db } from "@/db";

import type { VideoProgressInput } from "./schema";
import {
  allLessonsCompleted,
  assertMemberRole,
  isLessonUnlocked,
  isQuizEligible,
} from "./policy";
import {
  enrollUserInCourse,
  findLessonInPublishedCourse,
  findPublishedCourseWithFinalQuiz,
  selectAvailableCourses,
  selectCourseLessonScoreRows,
  selectEnrolledCourses,
  selectEnrollmentForCourse,
  selectEnrollmentFinalResult,
  selectLessonVideoGate,
  selectOpenLesson,
  selectOpenLessonQuiz,
  selectOutlineRows,
  selectPublishedCourseBySlug,
  setEnrollmentLastLesson,
  updateEnrollmentFinalResult,
  upsertLessonOpen,
  upsertLessonQuizResult,
  upsertLessonVideoProgress,
  type DbOrTx,
  type DbTx,
  type LessonGateLookup,
} from "./queries";
import {
  finalQuizHref,
  lessonHref,
  quizHref,
  resolvePlayback,
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
  type OpenQuizDTO,
  type OpenQuizRow,
  type PlaybackDTO,
  type VideoProgressResultDTO,
} from "./serializer";

export { finalQuizHref, lessonHref, quizHref };
export type {
  EnrollResultDTO,
  LearnerCourseDTO,
  EnrolledCourseDTO,
  LearnerDashboardDTO,
  LessonPageDTO,
  LessonOutlineItemDTO,
  LessonCourseDTO,
  OpenQuizDTO,
  OpenQuizRow,
  PlaybackDTO,
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
  tx: DbOrTx,
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
 * The lesson page (card S2-01 §1, S2-02 §3, S3-01 §4.A) — a pure GET: three
 * SELECTs (course, enrollment, outline) and a FOURTH for the document +
 * video source, run only when the state is `open` (V-06: the material AND
 * the video id of a locked lesson are never read, not just never shown).
 * Card S3-01 adds the open lesson's quiz summary to that fourth read —
 * still GET-only, still gated on `open`.
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
  const targetId = outline[targetIndex]!.id;
  const [openRow, quizRow] = willOpen
    ? await Promise.all([
        selectOpenLesson(targetId),
        selectOpenLessonQuiz(targetId, actor.id),
      ])
    : [undefined, undefined];
  return toLessonPageDTO({
    course,
    enrollment,
    outline,
    targetIndex,
    content: openRow?.content ?? null,
    playback: openRow ? resolvePlayback(openRow) : null,
    quizRow: quizRow ?? null,
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

// ------------------------------------------------------------- S3-01 quiz

/** What the attempt module needs to know about a lesson (card S3-01 §1):
 *  the wrap of loadUnlockedLessonContext over the SAME rows the lesson page
 *  reads, plus the quiz gate + the next-lesson pointer the quiz page shows
 *  on its result screen. */
export type LessonQuizContext = {
  enrollmentId: string;
  /** lessons.quiz_id — null when the lesson has no quiz (defensive 404 in
   *  the attempt service; a quiz card never rendered for such a lesson). */
  quizId: string | null;
  courseSlug: string;
  lessonSlug: string;
  lessonPosition: number;
  /** The video gate (CRS-08): watched percent ≥ 90 or no READY video. */
  eligible: boolean;
  next: { position: number; href: string } | null;
  /** Card S5-02 §5: non-null exactly when every lesson is COMPLETED and
   *  the course has a Final Quiz — the result screen's closing swap. */
  finalQuizHref: string | null;
};

/**
 * The attempt module's entry into this module's gate (card S3-01 §1) —
 * runs INSIDE the caller's transaction so start/submit decide on rows the
 * lesson page would agree with. Throws the same errors as the open/video
 * paths: uniform 404 for every miss, 409 for a locked lesson.
 */
export async function loadLessonQuizContext(
  tx: DbOrTx,
  actorId: string,
  lessonId: string,
): Promise<LessonQuizContext> {
  const context = await loadUnlockedLessonContext(tx, actorId, lessonId);
  const target = context.outline[context.targetIndex]!;
  const nextRow = context.outline[context.targetIndex + 1];
  return {
    enrollmentId: context.enrollmentId,
    quizId: context.lesson.quizId,
    courseSlug: context.course.slug,
    lessonSlug: target.slug,
    lessonPosition: context.targetIndex + 1,
    eligible: isQuizEligible(target),
    next: nextRow
      ? {
          position: context.targetIndex + 2,
          href: lessonHref(context.course.slug, nextRow.slug),
        }
      : null,
    finalQuizHref:
      context.course.finalQuizId !== null &&
      allLessonsCompleted(context.outline)
        ? finalQuizHref(context.course.slug)
        : null,
  };
}

/**
 * Record a lesson-quiz result INTO the caller's (submit) transaction (card
 * S3-01 §1): quiz_attempted + score columns always; status reaches
 * COMPLETED — with completed_at, only-if-null — exactly when the video
 * requirement is met (CRS-08: video ≥ 90 % OR no READY video; quiz
 * attempted, passing NOT required). The lesson_progress row may not exist
 * yet (quiz-first visit); enrollments and courses are untouched.
 */
export async function recordLessonQuizResult(
  tx: DbTx,
  input: {
    actorId: string;
    lessonId: string;
    enrollmentId: string;
    scorePercent: number;
    isPassed: boolean;
    submittedAt: Date;
  },
): Promise<void> {
  const gate = await selectLessonVideoGate(tx, input.actorId, input.lessonId);
  if (!gate) {
    // Unreachable with valid data (the attempt's quiz belongs to a lesson
    // row) — fail loud rather than recording progress for a ghost lesson.
    throw new Error("progress service: quiz result without a lesson row");
  }
  await upsertLessonQuizResult(tx, {
    actorId: input.actorId,
    lessonId: input.lessonId,
    enrollmentId: input.enrollmentId,
    videoRequirementMet: isQuizEligible(gate),
    scorePercent: input.scorePercent,
    isPassed: input.isPassed,
    submittedAt: input.submittedAt,
  });
}

// ------------------------------------------------------------- S5-02 final quiz

/** The score split of the Nilai Akhir formula (PRG-05), spelled out LOCALLY
 *  (card S5-02): the quiz module's service owns the source of truth
 *  (system_settings) and hands over plain numbers — this module takes them
 *  as values, so no quiz-module type is imported here. */
export type FinalScoreWeights = {
  lessonPercent: number;
  finalPercent: number;
};

/**
 * What the attempt module needs to run the Final Quiz flow (card S5-02 §1):
 * the not-enrolled redirect on one branch; on the other, the gate answers
 * (`allCompleted`, `firstIncompleteHref`), the rules screen's pointers
 * (`lastLessonHref`, `lessonAveragePercent` rounded for display), and the
 * ids the start/submit transactions write with. Built from the SAME
 * outline rows the lesson page reads.
 */
export type FinalQuizContext =
  | { enrolled: false; firstLessonHref: string }
  | {
      enrolled: true;
      enrollmentId: string;
      courseId: string;
      quizId: string;
      courseSlug: string;
      courseTitle: string;
      /** The gate (QZ-13): every lesson COMPLETED. */
      allCompleted: boolean;
      /** Null exactly when allCompleted — where "kembali" points. */
      firstIncompleteHref: string | null;
      /** "Ulas materi dulu" on the rules screen (7h). */
      lastLessonHref: string;
      /** Rounded average of the lesson quiz scores; null before the gate
       *  opens (the formula itself re-reads exact scores at submit). */
      lessonAveragePercent: number | null;
    };

/**
 * The attempt module's entry into the Final Quiz gate (card S5-02 §1) —
 * runs INSIDE the caller's transaction (or on `db` for the pure-GET page).
 * Unknown course, unpublished, no Final Quiz, or an empty outline → the
 * SAME NotFoundError, so existence never leaks; not-enrolled is a VALUE,
 * not an error (the page redirects, the start endpoint 404s uniformly).
 */
export async function loadFinalQuizContext(
  executor: DbOrTx,
  actorId: string,
  target: { courseId: string } | { courseSlug: string },
): Promise<FinalQuizContext> {
  const course = await findPublishedCourseWithFinalQuiz(executor, target);
  if (!course) {
    throw new NotFoundError("Kursus tidak ditemukan.");
  }
  const enrollment = await selectEnrollmentForCourse(
    executor,
    actorId,
    course.id,
  );
  if (!enrollment) {
    if (course.firstLessonSlug === null) {
      // Same unreachable-with-valid-data stance as firstLessonSlugOf.
      throw new NotFoundError("Kursus tidak ditemukan.");
    }
    return {
      enrolled: false,
      firstLessonHref: lessonHref(course.slug, course.firstLessonSlug),
    };
  }
  const outline = await selectOutlineRows(executor, actorId, course.id);
  if (outline.length === 0) {
    // Unreachable with valid data (enrollment implies lessons, and the
    // gate below would never open) — fail with the uniform 404.
    throw new NotFoundError("Kursus tidak ditemukan.");
  }
  const firstIncomplete = outline.find((row) => row.status !== "COMPLETED");
  const allCompleted = allLessonsCompleted(outline);
  return {
    enrolled: true,
    enrollmentId: enrollment.id,
    courseId: course.id,
    quizId: course.finalQuizId,
    courseSlug: course.slug,
    courseTitle: course.title,
    allCompleted,
    firstIncompleteHref: firstIncomplete
      ? lessonHref(course.slug, firstIncomplete.slug)
      : null,
    lastLessonHref: lessonHref(
      course.slug,
      outline[outline.length - 1]!.slug,
    ),
    lessonAveragePercent: allCompleted
      ? Math.round(
          outline.reduce(
            (total, row) => total + Number(row.quizScorePercent ?? 0),
            0,
          ) / outline.length,
        )
      : null,
  };
}

/**
 * Record the Final Quiz result INTO the caller's (submit) transaction (card
 * S5-02 §1): Nilai Akhir = round2(rata-rata quiz materi × lesson% + nilai
 * Final × final%) stored on enrollments.final_score_percent; status PASSED
 * when the FINAL attempt passed (not when Nilai Akhir ≥ 70 — PRD QZ-13 over
 * the 7h sketch), else COMPLETED; completed_at only-if-null. Lesson scores
 * are RE-READ here (full-ownership read inside the same transaction), and a
 * NULL score fails LOUD: a valid Final attempt implies every lesson
 * COMPLETED with a score, and a silent 0 would misrecord the course result
 * forever. lesson_progress and courses are untouched.
 */
export async function recordFinalQuizResult(
  tx: DbTx,
  input: {
    actorId: string;
    courseId: string;
    enrollmentId: string;
    /** The final attempt's score percent (0–100). */
    finalScorePercent: number;
    isPassed: boolean;
    weights: FinalScoreWeights;
    submittedAt: Date;
  },
): Promise<{ finalScorePercent: number; courseStatus: "COMPLETED" | "PASSED" }> {
  const rows = await selectCourseLessonScoreRows(
    tx,
    input.actorId,
    input.courseId,
  );
  if (rows.length === 0) {
    // Unreachable with valid data (the gate opened ⇒ lessons exist).
    throw new Error("progress service: final result without lessons");
  }
  if (rows.some((row) => row.scorePercent === null)) {
    throw new Error("progress service: final result without a lesson score");
  }
  const average =
    rows.reduce((total, row) => total + Number(row.scorePercent), 0) /
    rows.length;
  const finalScorePercent =
    Math.round(
      (average * (input.weights.lessonPercent / 100) +
        input.finalScorePercent * (input.weights.finalPercent / 100)) *
        100,
    ) / 100;
  const courseStatus = input.isPassed ? ("PASSED" as const) : ("COMPLETED" as const);
  await updateEnrollmentFinalResult(tx, {
    enrollmentId: input.enrollmentId,
    actorId: input.actorId,
    finalScorePercent: finalScorePercent.toFixed(2),
    status: courseStatus,
    completedAt: input.submittedAt,
  });
  return { finalScorePercent: finalScorePercent, courseStatus };
}

/**
 * The Final result screen's display read (card S5-02 §2): the STORED Nilai
 * Akhir (rounded for display, null only before a first submit — unreachable
 * on the result screen) and the course status badge source.
 */
export async function getEnrollmentFinalResult(
  executor: DbOrTx,
  actorId: string,
  courseId: string,
): Promise<
  | {
      finalScorePercent: number | null;
      status: "IN_PROGRESS" | "COMPLETED" | "PASSED";
    }
  | undefined
> {
  const row = await selectEnrollmentFinalResult(executor, actorId, courseId);
  if (!row) return undefined;
  return {
    finalScorePercent:
      row.finalScorePercent === null
        ? null
        : Math.round(Number(row.finalScorePercent)),
    status: row.status,
  };
}
