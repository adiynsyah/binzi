import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { contents } from "@/db/schema";

/**
 * Public featured Articles query (TASK 037, UI/UX §4 "Featured
 * Articles").
 *
 * An Article is a Content type — there is no separate Article table
 * (Decisions Log #2). Publication is enforced IN THE QUERY,
 * server-side: only `status = 'PUBLISHED'` ARTICLE rows are returned,
 * so drafts never reach the public homepage (UI/UX §44, Business
 * Rules §5 "Browse published Articles" for guests).
 *
 * `slug IS NOT NULL` is required for a row to be linkable at
 * /articles/[slug] (slugs are unique-when-non-null, Decisions Log #5);
 * a slug-less published ARTICLE simply has no public URL yet and is
 * not featured. Ordering: publishedAt DESC, then id DESC as a stable
 * tiebreak (the same convention as listCourses).
 */
export const FEATURED_ARTICLES_LIMIT = 3;

export type FeaturedArticle = {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date;
};

export async function listPublishedArticles(
  limit: number = FEATURED_ARTICLES_LIMIT,
): Promise<FeaturedArticle[]> {
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
