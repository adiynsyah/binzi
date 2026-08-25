import { and, desc, eq, isNotNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { contents } from "@/db/schema";

/**
 * Related Articles query (TASK 041, UI/UX §28 "Related Articles";
 * Task Plan 041 "Related content where appropriate").
 *
 * There is no category/tag/relation field anywhere in the schema
 * (contents has no such column — Drizzle Spec §8), so the only
 * grounded "related" definition available to V1 is "the other
 * published Articles", listed with the same repository convention
 * as every public article list (publishedAt DESC, id DESC —
 * listPublishedArticles, listPublishedArticlesForCatalog). FLAG:
 * this is a recency-based reading, not a topical one.
 *
 * Publication boundaries are enforced IN THE QUERY, server-side,
 * exactly like the catalog: only `type = 'ARTICLE'` AND
 * `status = 'PUBLISHED'` AND `slug IS NOT NULL` rows can return,
 * and the current article is excluded by id. The limit mirrors the
 * featured-articles convention (3).
 */
export const RELATED_ARTICLES_LIMIT = 3;

export type RelatedArticle = {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date;
};

export async function listRelatedArticles(
  articleId: string,
  limit: number = RELATED_ARTICLES_LIMIT,
): Promise<RelatedArticle[]> {
  const rows = await db
    .select({
      id: contents.id,
      title: contents.title,
      slug: contents.slug,
      publishedAt: contents.publishedAt,
    })
    .from(contents)
    .where(
      and(
        eq(contents.type, "ARTICLE"),
        eq(contents.status, "PUBLISHED"),
        isNotNull(contents.slug),
        ne(contents.id, articleId),
      ),
    )
    .orderBy(desc(contents.publishedAt), desc(contents.id))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    // Non-null by construction: the WHERE clause filters on it.
    slug: row.slug as string,
    publishedAt: row.publishedAt as Date,
  }));
}
