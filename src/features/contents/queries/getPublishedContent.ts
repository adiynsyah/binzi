import { and, eq } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";

import { db } from "@/db";
import { contents } from "@/db/schema";

/**
 * Public Content query (TASK 020, Blueprint §34 "Public Article
 * Implementation", Business Rules §4.5/§5).
 *
 * Publication is enforced IN THE QUERY, server-side: the only rows
 * this can ever return are `status = 'PUBLISHED'` rows. Drafts and
 * unpublished content are indistinguishable from nonexistent slugs
 * (both yield null → the route renders 404), which is exactly the
 * "Draft Article: not publicly indexed" behavior of Blueprint §34.
 *
 * Only ARTICLE rows resolve here. The standalone-public capability
 * is Article-exclusive in the source of truth: "Published Article
 * Content should be accessible through /articles/[slug]" (Blueprint
 * §34; also Decisions Log #5, UI/UX §28), "An Article Content item
 * can be … Published as a standalone public article" (Business
 * Rules §4.2), and guests may "Browse published Articles"
 * (Business Rules §5). Generic "Published Content … can be publicly
 * viewed according to access rules" (§4.5) defers to those rules —
 * other published types are delivered inside Course/Lesson pages
 * of later milestones, never at this route.
 */

export type PublishedArticleContent = {
  id: string;
  title: string;
  slug: string;
  type: (typeof contents.$inferSelect)["type"];
  body: JSONContent;
  publishedAt: Date;
};

export async function getPublishedContentBySlug(
  slug: string,
): Promise<PublishedArticleContent | null> {
  const rows = await db
    .select({
      id: contents.id,
      title: contents.title,
      slug: contents.slug,
      type: contents.type,
      body: contents.body,
      publishedAt: contents.publishedAt,
    })
    .from(contents)
    .where(
      and(
        eq(contents.slug, slug),
        eq(contents.status, "PUBLISHED"),
        eq(contents.type, "ARTICLE"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    // Non-null by construction: the WHERE clause matches on slug.
    slug: row.slug as string,
    type: row.type,
    body: row.body as JSONContent,
    publishedAt: row.publishedAt as Date,
  };
}
