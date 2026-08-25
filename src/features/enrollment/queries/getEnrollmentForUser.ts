import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { enrollments } from "@/db/schema";

/**
 * Enrollment lookup for the Course Detail CTA ladder (TASK 042,
 * UI/UX §9 "Enrollment CTA"; Business Rules §8).
 *
 * Returns exactly what the public page needs to pick a CTA state —
 * the enrollment status, or null when the user is not enrolled.
 * No ids, timestamps, or other columns leave the query: the page
 * renders labels and links only, and the write path (enrollCourse)
 * re-derives everything server-side.
 *
 * Uniqueness is structural: UNIQUE(user_id, course_id) on the
 * enrollments table guarantees at most one row per pair, so
 * limit(1) never hides a second state.
 */
export async function getEnrollmentForUser(
  userId: string,
  courseId: string,
): Promise<{ status: "ACTIVE" | "COMPLETED" } | null> {
  const rows = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
