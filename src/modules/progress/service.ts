// Service layer for the progress module (card S5-01 §1) — the ONLY surface
// other modules may import (src/modules/README.md). Guards run role FIRST,
// then input (guard order); everything returned is an explicit DTO.
import type { SessionUser } from "@/lib/rbac";
import { NotFoundError } from "@/lib/errors";
import { UUID_PATTERN } from "@/modules/course/schema";

import { assertMemberRole } from "./policy";
import {
  enrollUserInCourse,
  selectAvailableCourses,
  selectEnrolledCourses,
} from "./queries";
import {
  lessonHref,
  toEnrolledCourseDTO,
  toLearnerCourseDTO,
  type EnrollResultDTO,
  type LearnerCourseDTO,
  type EnrolledCourseDTO,
  type LearnerDashboardDTO,
} from "./serializer";

export { lessonHref };
export type {
  EnrollResultDTO,
  LearnerCourseDTO,
  EnrolledCourseDTO,
  LearnerDashboardDTO,
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
