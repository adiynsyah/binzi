import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env";
import { listPublishedCourses } from "@/features/courses/queries/listPublishedCourses";
import { listPublishedArticlesForCatalog } from "@/features/contents/queries/listPublishedArticlesForCatalog";

/**
 * Public sitemap (TASK 063, Blueprint §44 "SEO Implementation").
 *
 * Lists exactly the public, indexable surfaces (UI/UX §44 / Blueprint
 * §34): the homepage, the two catalogs, and one URL per PUBLISHED
 * course / published slug-bearing ARTICLE. Publication is enforced
 * inside the reused catalog queries (status/type/slug boundaries), so
 * DRAFT courses, DRAFT articles, and slug-less rows can never enter
 * the sitemap — the same server-side boundary as the pages themselves.
 *
 * Only url + lastModified are emitted: the sitemap protocol makes
 * changeFrequency/priority optional hints and no source specifies
 * values for them, so none are invented. Course entries carry no
 * lastModified because the reused TASK 038 catalog query deliberately
 * does not select publishedAt; article entries use their publishedAt.
 *
 * Private/authenticated surfaces (/admin, /courses/[slug]/learn/...,
 * /profile) are intentionally absent — they are proxy-gated and hold
 * no indexable content.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const [courses, articles] = await Promise.all([
    listPublishedCourses(),
    listPublishedArticlesForCatalog(),
  ]);

  return [
    { url: site },
    { url: `${site}/courses` },
    { url: `${site}/articles` },
    ...courses.map((course) => ({
      url: `${site}/courses/${course.slug}`,
    })),
    ...articles.map((article) => ({
      url: `${site}/articles/${article.slug}`,
      lastModified: article.publishedAt,
    })),
  ];
}
