// Role policy for the progress module (card S5-01 §1) + the lesson access
// gate (card S2-01 §1). Module-internal: the service applies this FIRST —
// role before any input parsing (guard order, src/modules/README.md).
// Everything the learner dashboard does is MEMBER+ (PRD §3.2); the route
// layer checks the same minimum, so the two layers agree by construction.
import type { progressStatusEnum, videoStatusEnum } from "@/db/schema";
import { roleAtLeast, type SessionUser } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

/**
 * MEMBER+ or 403. `roleAtLeast` fails closed for a role outside the enum
 * (unknown ranks are undefined → not >= MEMBER), which is exactly what the
 * integration test proves with a cast.
 */
export function assertMemberRole(actor: SessionUser): void {
  if (!roleAtLeast(actor.role, "MEMBER")) {
    throw new ForbiddenError("Aksi ini memerlukan peran member");
  }
}

/**
 * One outline row as the gate sees it (card S2-01 §1): whether THIS
 * participant attempted the lesson's quiz. `null` = no lesson_progress
 * row yet, which counts as unattempted.
 */
export type LessonGateRow = {
  quizAttempted: boolean | null;
};

/**
 * CRS-08 sequential access (PRD §11.4 no. 7): a non-sequential course is
 * always open; position 1 is always open; every later position opens only
 * when the DIRECT predecessor's quiz was attempted — not "all previous
 * lessons". `position` is 1-based.
 */
export function isLessonUnlocked(
  position: number,
  outline: readonly LessonGateRow[],
  isSequential: boolean,
): boolean {
  if (!isSequential) return true;
  if (position <= 1) return true;
  const predecessor = outline[position - 2];
  return predecessor?.quizAttempted === true;
}

/**
 * The smallest position that is open AND whose quiz this participant has
 * not attempted yet — where "Buka materi {k}" on a locked panel points, so
 * a participant who jumps straight to lesson 5 is sent back to the exact
 * step they owe. `null` when every open lesson has been attempted (not
 * reachable with valid data: the locked lesson itself would be open).
 */
export function firstOpenUnattempted(
  outline: readonly LessonGateRow[],
  isSequential: boolean,
): number | null {
  for (let index = 0; index < outline.length; index += 1) {
    const position = index + 1;
    if (!isLessonUnlocked(position, outline, isSequential)) continue;
    if (outline[index]?.quizAttempted === true) continue;
    return position;
  }
  return null;
}

// ------------------------------------------------------------- S3-01 quiz gate

/**
 * The quiz unlock threshold (CRS-08 via card S3-01): the watched percent at
 * which a lesson's quiz opens. `>=` — 90.00 already counts (mutation 14 of
 * the card guards exactly this boundary).
 */
export const QUIZ_UNLOCK_PERCENT = 90;

/**
 * Is the lesson's quiz open for this participant (card S3-01 §1)? A lesson
 * without a READY video carries no video requirement — its quiz is eligible
 * from the first open. `videoWatchedPercent` is the NUMERIC string as it
 * leaves the driver (NULL = no progress row yet = 0).
 */
export function isQuizEligible(row: {
  videoStatus: (typeof videoStatusEnum.enumValues)[number];
  videoWatchedPercent: string | null;
}): boolean {
  if (row.videoStatus !== "READY") return true;
  return Number(row.videoWatchedPercent ?? 0) >= QUIZ_UNLOCK_PERCENT;
}

// --------------------------------------------------- S5-02 final-quiz gate

/**
 * The Final Quiz gate (card S5-02 §1, QZ-13): EVERY lesson of the course is
 * COMPLETED — and there is at least one lesson (a course without lessons
 * can never open the Final Quiz). A NULL status (no lesson_progress row for
 * this participant) counts as not completed, exactly like IN_PROGRESS.
 */
export function allLessonsCompleted(
  outline: readonly {
    status: (typeof progressStatusEnum.enumValues)[number] | null;
  }[],
): boolean {
  return (
    outline.length > 0 && outline.every((row) => row.status === "COMPLETED")
  );
}

// ------------------------------------------- S5-04 course progress statuses

/**
 * The five per-lesson statuses of the course progress page (card S5-04
 * decision 3): PRG-10's four (Terkunci / Sedang dipelajari / Quiz belum
 * dikerjakan / Selesai) plus "belum mulai" for an open lesson that was
 * never opened — without it a non-sequential course would mislabel.
 */
export type CourseLessonStatus =
  | "selesai"
  | "terkunci"
  | "quiz-belum"
  | "sedang-dipelajari"
  | "belum-mulai";

/** One outline row as the progress page sees it: the gate/eligibility
 *  columns of LessonOutlineRow (the query's LEFT JOIN keeps every progress
 *  column NULLable for "no lesson_progress row for THIS participant"). */
export type CourseLessonStatusRow = {
  status: (typeof progressStatusEnum.enumValues)[number] | null;
  quizAttempted: boolean | null;
  videoStatus: (typeof videoStatusEnum.enumValues)[number];
  /** NUMERIC as it leaves the driver — isQuizEligible Number()s it. */
  videoWatchedPercent: string | null;
};

/**
 * The progress page's per-lesson status (card S5-04 decision 3), priority
 * top to bottom — one pure function so the serializer never re-derives it:
 *   1. COMPLETED → selesai (beats the gate, the S2-01 outline rule: a
 *      completed lesson stays completed even if the gate re-locked it);
 *   2. gate locked → terkunci;
 *   3. quiz attempted but not COMPLETED (video requirement unmet) →
 *      sedang-dipelajari;
 *   4. opened (a status row exists and left NOT_STARTED) AND quiz
 *      eligible (video ≥ 90 % or no READY video) → quiz-belum;
 *   5. opened → sedang-dipelajari;
 *   6. otherwise → belum-mulai.
 * A live quiz attempt does NOT count as attempted (quiz_attempted is
 * written at submit), so a running attempt still reads quiz-belum here
 * while the lesson page's quiz card says "berjalan" — same data, different
 * question (noted in the PR's Keputusan & asumsi).
 */
export function courseLessonStatus(
  position: number,
  row: CourseLessonStatusRow,
  outline: readonly CourseLessonStatusRow[],
  isSequential: boolean,
): CourseLessonStatus {
  if (row.status === "COMPLETED") return "selesai";
  if (!isLessonUnlocked(position, outline, isSequential)) return "terkunci";
  if (row.quizAttempted === true) return "sedang-dipelajari";
  const opened = row.status !== null && row.status !== "NOT_STARTED";
  if (opened && isQuizEligible(row)) return "quiz-belum";
  if (opened) return "sedang-dipelajari";
  return "belum-mulai";
}
