import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env";

/**
 * robots.txt (TASK 063, Blueprint §44 "SEO Implementation").
 *
 * Public content is crawlable; the two private prefixes are excluded:
 * - /admin  — the CMS (proxy-gated, TASK 013/014)
 * - /profile — the account page (proxy-gated, TASK 013)
 *
 * The learning area (/courses/[slug]/learn/...) is not listed: it has
 * no robots.txt-safe prefix (a /courses/ rule would also block the
 * public catalog and detail pages UI/UX §44 wants indexed), and every
 * learn URL already 307-redirects anonymous crawlers to /login at the
 * proxy, so no indexable content is ever rendered there. DRAFT content
 * never renders publicly at all (404, indistinguishable from unknown
 * slugs — UI/UX §44 "Draft content must not be indexed").
 *
 * robots.txt is a crawl hint, not an access control; authorization
 * stays enforced server-side (proxy + queries).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/profile"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
