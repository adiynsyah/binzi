import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { contents, lessonContents, lessons } from "@/db/schema";

/**
 * Lesson editor data access (TASK 028, CMS Spec §9).
 *
 * Server-side, read-only queries through the single Drizzle client.
 * getLessonForEditor enforces course ownership INSIDE the query — a
 * lesson id from another course matches no row and 404s exactly like
 * an unknown id, so the editor can never render a lesson outside its
 * route context (IDOR-safe by construction).
 *
 * getLessonContents returns the assigned Content in the lesson's
 * explicit per-lesson sort_order (UNIQUE(lesson_id, sort_order),
 * CHECK sort_order > 0): ascending sort is fully deterministic with
 * no tie-breaker needed (BR §3.2/§27 ordering discipline).
 */

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EditorLesson = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED";
  sortOrder: number;
};

/**
 * Loads a lesson only when it belongs to the given course. Returns
 * null for malformed/unknown ids AND for lessons of another course —
 * the caller renders one identical 404 for all three cases.
 */
export async function getLessonForEditor(
  courseId: string,
  lessonId: string,
): Promise<EditorLesson | null> {
  if (!UUID_PATTERN.test(courseId) || !UUID_PATTERN.test(lessonId)) {
    return null;
  }

  const rows = await db
    .select({
      id: lessons.id,
      courseId: lessons.courseId,
      title: lessons.title,
      description: lessons.description,
      status: lessons.status,
      sortOrder: lessons.sortOrder,
    })
    .from(lessons)
    // Ownership is part of the match itself, never a post-hoc check.
    .where(and(eq(lessons.courseId, courseId), eq(lessons.id, lessonId)))
    .limit(1);

  return rows[0] ?? null;
}

export type AssignedContentItem = {
  contentId: string;
  title: string;
  type: (typeof contents.$inferSelect)["type"];
  status: "DRAFT" | "PUBLISHED";
  sortOrder: number;
};

/** Assigned Content of a lesson, in persisted order (CMS §9/§10). */
export async function getLessonContents(
  lessonId: string,
): Promise<AssignedContentItem[]> {
  if (!UUID_PATTERN.test(lessonId)) {
    return [];
  }

  return db
    .select({
      contentId: lessonContents.contentId,
      title: contents.title,
      type: contents.type,
      status: contents.status,
      sortOrder: lessonContents.sortOrder,
    })
    .from(lessonContents)
    .innerJoin(contents, eq(contents.id, lessonContents.contentId))
    .where(eq(lessonContents.lessonId, lessonId))
    .orderBy(asc(lessonContents.sortOrder));
}
