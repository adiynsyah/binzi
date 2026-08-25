import { and, asc, eq } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";

import { db } from "@/db";
import { contents, lessonContents } from "@/db/schema";

/**
 * Learning content read model (TASK 046, Task Plan "Render Content in
 * persisted order"; Blueprint §16 query list names getLessonForLearning;
 * UI/UX §12 "Lesson Content").
 *
 * Loads the renderable Content of ONE lesson in the lesson's explicit
 * per-lesson sort_order (UNIQUE(lesson_id, sort_order), CHECK > 0 —
 * ascending sort is fully deterministic, no tie-breaker needed; same
 * ordering discipline as the CMS editor query in TASK 028).
 *
 * The caller is the lesson page, which has ALREADY passed the single
 * centralized access gate (canAccessLesson, TASK 044): the lesson id
 * given here comes from that server-resolved result, never from client
 * input. Publication is enforced IN THE QUERY — only status='PUBLISHED'
 * contents are returned, so an admin flipping a content row back to
 * DRAFT removes it from the learning page without any route change
 * (drafts indistinguishable from unassigned, UI/UX §44 discipline).
 *
 * Read-only (Blueprint §16 "Queries should not mutate state"): one
 * SELECT, no lesson_progress writes — viewing a lesson never records
 * progress (Decisions Log #12).
 *
 * Payload is render-minimal: no internal ids (sort_order keys the
 * React list), no admin columns. `body` is the Tiptap document that
 * renderTiptapHtml serializes; `metadata` stays `unknown` and is
 * parsed defensively by the renderer (only VIDEO consumes it).
 */

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LessonContentItem = {
  type: (typeof contents.$inferSelect)["type"];
  title: string;
  body: JSONContent;
  metadata: unknown;
  sortOrder: number;
};

/**
 * Published Content of a lesson, in persisted order. Malformed or
 * unknown lesson ids yield [] — the caller renders the lesson title
 * with no content blocks (a published lesson may legitimately have
 * zero published contents; there is no fabricated placeholder).
 */
export async function getLessonForLearning(
  lessonId: string,
): Promise<LessonContentItem[]> {
  if (!UUID_PATTERN.test(lessonId)) {
    return [];
  }

  const rows = await db
    .select({
      type: contents.type,
      title: contents.title,
      body: contents.body,
      metadata: contents.metadata,
      sortOrder: lessonContents.sortOrder,
    })
    .from(lessonContents)
    .innerJoin(contents, eq(contents.id, lessonContents.contentId))
    .where(
      and(
        eq(lessonContents.lessonId, lessonId),
        eq(contents.status, "PUBLISHED"),
      ),
    )
    .orderBy(asc(lessonContents.sortOrder));

  // jsonb columns arrive as unknown; the shape is exactly what
  // renderTiptapHtml / the renderer validate at the boundary.
  return rows.map((row) => ({
    type: row.type,
    title: row.title,
    body: row.body as JSONContent,
    metadata: row.metadata,
    sortOrder: row.sortOrder,
  }));
}
