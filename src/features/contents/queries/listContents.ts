import { and, count, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { contents, lessonContents } from "@/db/schema";

import type { ContentListQuery } from "../schemas/content-list.schema";

/**
 * Content List query (TASK 016, CMS Spec §13, Drizzle Spec §20).
 *
 * Server-side data access through the single existing Drizzle
 * client (server-only via @/db). Search filters the title with
 * ILIKE (CMS §13 "Search: Title"), status/type filters use the
 * enum columns behind contents_status_idx / contents_type_idx.
 * All values are bound parameters — no string-concatenated SQL.
 *
 * "Used In" counts lesson_contents rows per Content (CMS §13).
 *
 * Deterministic ordering: updatedAt DESC, then id DESC as a
 * stable tiebreak, so pages never shuffle between requests.
 */

/** Fixed page size keeps the list bounded as the CMS grows. */
export const CONTENT_LIST_PAGE_SIZE = 10;

export type ContentListItem = {
  id: string;
  title: string;
  type: (typeof contents.$inferSelect)["type"];
  status: (typeof contents.$inferSelect)["status"];
  updatedAt: Date;
  usedInCount: number;
};

export type ContentListResult = {
  rows: ContentListItem[];
  total: number;
  page: number;
  pageCount: number;
};

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listContents(
  query: ContentListQuery,
): Promise<ContentListResult> {
  const conditions = [];

  if (query.q) {
    conditions.push(ilike(contents.title, `%${escapeLike(query.q)}%`));
  }
  if (query.status) {
    conditions.push(eq(contents.status, query.status));
  }
  if (query.type) {
    conditions.push(eq(contents.type, query.type));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await db
    .select({ value: count() })
    .from(contents)
    .where(where);
  const total = totalRows[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / CONTENT_LIST_PAGE_SIZE));

  // Out-of-range pages clamp to the last existing page.
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const offset = (page - 1) * CONTENT_LIST_PAGE_SIZE;

  const rows = await db
    .select({
      id: contents.id,
      title: contents.title,
      type: contents.type,
      status: contents.status,
      updatedAt: contents.updatedAt,
      usedInCount: count(lessonContents.id),
    })
    .from(contents)
    .leftJoin(lessonContents, eq(lessonContents.contentId, contents.id))
    .where(where)
    .groupBy(contents.id)
    .orderBy(desc(contents.updatedAt), desc(contents.id))
    .limit(CONTENT_LIST_PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount };
}
