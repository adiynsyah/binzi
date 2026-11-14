// Role policy for the progress module (card S5-01 §1) + the lesson access
// gate (card S2-01 §1). Module-internal: the service applies this FIRST —
// role before any input parsing (guard order, src/modules/README.md).
// Everything the learner dashboard does is MEMBER+ (PRD §3.2); the route
// layer checks the same minimum, so the two layers agree by construction.
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
