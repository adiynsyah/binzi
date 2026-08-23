import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contents } from "@/db/schema";

import type { EditableContent } from "../schemas/content-edit.schema";

/**
 * Content-by-id query for the edit page (TASK 019, CMS Spec §14).
 *
 * Server-side data access through the single Drizzle client. The
 * route only needs the editable field set; status is included so the
 * form can show the current status note, and publishedAt (read-only,
 * nullable) supports status display and the TASK 021 admin preview
 * date line. body is the stored Tiptap JSON document (JSONB) — it is
 * returned as-is; any change is re-validated server-side before
 * persistence on save.
 */

/** Matches uuid values produced by Postgres/gen_random_uuid(). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getContentById(
  id: string,
): Promise<EditableContent | null> {
  // Non-uuid ids can never match; guard avoids a Postgres 22P02 error.
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const rows = await db
    .select({
      id: contents.id,
      title: contents.title,
      slug: contents.slug,
      type: contents.type,
      status: contents.status,
      publishedAt: contents.publishedAt,
      body: contents.body,
    })
    .from(contents)
    .where(eq(contents.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return { ...row, body: row.body as EditableContent["body"] };
}
