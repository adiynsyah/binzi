import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { contents } from "@/db/schema";

/**
 * Public Article Catalog query (TASK 040, Business Rules §5 "Browse
 * published Articles" for guests, Blueprint §4 route map).
 *
 * An Article is a Content type — there is no separate Article table
 * (Business Rules §3.2/§4.2, Decisions Log #2). Publication is enforced
 * IN THE QUERY, server-side: the only rows this can ever return are
 * `type = 'ARTICLE'` AND `status = 'PUBLISHED'` rows — draft articles
 * and non-article Content types (VIDEO/TEXT/TIP/INFOGRAPHIC) can never
 * reach the public catalog (UI/UX §44, Blueprint §34 "Draft Article:
 * admin preview only, not publicly indexed").
 *
 * `slug IS NOT NULL` is required for a row to be linkable at the
 * /articles/[slug] detail route (slugs are unique-when-non-null,
 * Decisions Log #5); a slug-less published ARTICLE has no public URL
 * and is not listed. The TASK 037 featured query (listPublishedArticles)
 * shares these boundaries but caps at 3 rows; the catalog lists the
 * full public set.
 *
 * Ordering: publishedAt DESC, then id DESC as a stable tiebreak — the
 * repository convention for public lists (listPublishedCourses,
 * listPublishedArticles). No pagination: TASK 040 defines none.
 */

export type CatalogArticle = {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date;
};

export async function listPublishedArticlesForCatalog(): Promise<
  CatalogArticle[]
> {
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
    .orderBy(desc(contents.publishedAt), desc(contents.id));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    // Non-null by construction: the WHERE clause filters on it.
    slug: row.slug as string,
    publishedAt: row.publishedAt as Date,
  }));
}
