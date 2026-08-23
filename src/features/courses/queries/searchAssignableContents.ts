import { count, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { contents, lessonContents, lessons } from "@/db/schema";
import { CONTENT_LIST_PAGE_SIZE } from "@/features/contents/queries/listContents";

import type { LessonContentSearchQuery } from "../schemas/lesson-content-search.schema";

/**
 * Assignment candidate search (TASK 028, CMS Spec §10/§11, BR §25).
 *
 * Server-side title search over ALL Content (DRAFT and PUBLISHED are
 * both assignable — the "all Content published" rule is a LESSON
 * publish-time checklist item in CMS §21, enforced by a later task,
 * not an assignment precondition). Follows the TASK 016 conventions:
 * ILIKE with escaped wildcards, bound parameters only, fixed page
 * size, deterministic ordering (updatedAt DESC, then id DESC).
 *
 * Availability (CMS §11 / BR §4.2/§4.3/§25): lesson_contents carries
 * the global UNIQUE(content_id) — one Content belongs to at most one
 * Lesson in V1. The LEFT JOIN (safe 1:1 thanks to that constraint)
 * surfaces each row's assignment owner so the UI can disable
 * already-assigned Content, wherever it is used. The mutation and the
 * database constraint remain the enforcing layers; this list is only
 * the prevention affordance the specs ask the CMS to provide.
 */

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export type AssignableContentItem = {
  id: string;
  title: string;
  type: (typeof contents.$inferSelect)["type"];
  status: "DRAFT" | "PUBLISHED";
  updatedAt: Date;
  /** null = available; otherwise the id of the owning lesson. */
  assignedLessonId: string | null;
  /** Title of the owning lesson, for the "used elsewhere" note. */
  assignedLessonTitle: string | null;
};

export type AssignableContentResult = {
  rows: AssignableContentItem[];
  total: number;
  page: number;
  pageCount: number;
};

export async function searchAssignableContents(
  query: LessonContentSearchQuery,
): Promise<AssignableContentResult> {
  const where = query.q
    ? ilike(contents.title, `%${escapeLike(query.q)}%`)
    : undefined;

  const totalRows = await db
    .select({ value: count() })
    .from(contents)
    .where(where);
  const total = totalRows[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / CONTENT_LIST_PAGE_SIZE));

  // Out-of-range pages clamp to the last existing page (TASK 016).
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const offset = (page - 1) * CONTENT_LIST_PAGE_SIZE;

  const rows = await db
    .select({
      id: contents.id,
      title: contents.title,
      type: contents.type,
      status: contents.status,
      updatedAt: contents.updatedAt,
      assignedLessonId: lessonContents.lessonId,
      assignedLessonTitle: lessons.title,
    })
    .from(contents)
    // 1:1 by UNIQUE(content_id) — never fans out rows.
    .leftJoin(lessonContents, eq(lessonContents.contentId, contents.id))
    .leftJoin(lessons, eq(lessons.id, lessonContents.lessonId))
    .where(where)
    .orderBy(desc(contents.updatedAt), desc(contents.id))
    .limit(CONTENT_LIST_PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount };
}
