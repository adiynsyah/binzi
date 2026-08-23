import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { lessons } from "@/db/schema";

/**
 * Ordered lesson rows for the Course Builder (TASK 024, CMS Spec §7 /
 * BR §3.2 + §27).
 *
 * Server-side, read-only data access through the single Drizzle client.
 * TASK 024 renders the persisted structure only — lesson create is
 * TASK 025, interactive reordering is TASK 026, deletion is TASK 027 —
 * so nothing here mutates. Ordering is the explicit per-course
 * sort_order (UNIQUE(course_id, sort_order), CHECK sort_order > 0);
 * ascending sort is therefore fully deterministic with no tie-breaker
 * needed.
 */

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BuilderLesson = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  sortOrder: number;
};

export async function getCourseLessons(
  courseId: string,
): Promise<BuilderLesson[]> {
  // Non-uuid ids can never match; guard avoids a Postgres 22P02 error.
  // (The edit page already 404s before calling this, but the guard
  // keeps the query safe for any future caller.)
  if (!UUID_PATTERN.test(courseId)) {
    return [];
  }

  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      status: lessons.status,
      sortOrder: lessons.sortOrder,
    })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.sortOrder));
}
