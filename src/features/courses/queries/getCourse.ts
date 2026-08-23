import { eq } from "drizzle-orm";

import { db } from "@/db";
import { courses } from "@/db/schema";

import type { EditableCourse } from "../schemas/course-metadata.schema";

/**
 * Course-by-id query for the edit page (TASK 023, CMS Spec §6).
 *
 * Server-side data access through the single Drizzle client. The route
 * needs the editable metadata field set plus the read-only slug (shown
 * as system-generated) and status (drives the form's status note).
 * publishedAt is not needed on this page — there is no course preview
 * in TASK 023 — so it is not selected.
 */

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCourseById(
  id: string,
): Promise<EditableCourse | null> {
  // Non-uuid ids can never match; guard avoids a Postgres 22P02 error.
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      thumbnailUrl: courses.thumbnailUrl,
      difficulty: courses.difficulty,
      estimatedDuration: courses.estimatedDuration,
      status: courses.status,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);

  return rows[0] ?? null;
}
