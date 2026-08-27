import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/Card/Card";
import { buildMetaDescription } from "@/features/contents/lib/extractTiptapText";
import { renderTiptapHtml } from "@/features/contents/lib/renderTiptapHtml";
import { getCourseConnectionForArticle } from "@/features/contents/queries/getCourseConnectionForArticle";
import { getPublishedContentBySlug } from "@/features/contents/queries/getPublishedContent";
import { listRelatedArticles } from "@/features/contents/queries/listRelatedArticles";

import styles from "./page.module.scss";

/**
 * Public Article Detail (TASK 041, UI/UX §28 "Article Experience",
 * §29 "Article → Course Connection", §44 SEO; Business Rules §5/§36;
 * Blueprint §34). Rebuilt from the TASK 020 standalone page into the
 * (public) shell — the Blueprint's recommended structure places
 * articles/ inside (public), and TASK 036 FLAG-4 deferred exactly
 * this move. The URL /articles/[slug] is unchanged.
 *
 * Publication is enforced IN THE QUERY (getPublishedContentBySlug:
 * slug + status='PUBLISHED' + type='ARTICLE'), so a DRAFT article
 * and an unknown slug render the same 404 — drafts are never
 * publicly distinguishable (UI/UX §44, Blueprint §34). Guests may
 * read published articles without logging in (Business Rules §5);
 * articles never create or consume Course progress (BR §36/§37),
 * so the page renders identically for every visitor.
 *
 * SEO metadata (Task Plan 041): title + description + Open Graph
 * article metadata. The description is derived from the Tiptap body
 * — the only grounded text source, since contents has no excerpt
 * column. Canonical/absolute URLs are NOT emitted: no site origin
 * is configured in env (TASK 004) and adding one is outside TASK
 * 041 ownership (FLAG).
 *
 * Section order follows UI/UX §28 exactly: metadata, title, body,
 * Related Articles, then the course CTA. §29 makes the course
 * connection optional and contextual: it renders only when this
 * content is assigned to a Lesson of a PUBLISHED course
 * (getCourseConnectionForArticle enforces the status server-side).
 * There is no schema field for "Short introduction" (Drizzle Spec
 * §8) — omitted (FLAG).
 */

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublishedContentBySlug(slug);

  if (!content) {
    return { title: "Artikel Tidak Ditemukan — BINZI" };
  }

  const description = buildMetaDescription(content.body);

  return {
    title: `${content.title} — BINZI`,
    ...(description !== undefined ? { description } : {}),
    // TASK 063, Blueprint §44: canonical URL for the indexable article
    // page (UI/UX §44 "Public Article pages should be indexable").
    alternates: {
      canonical: `/articles/${content.slug}`,
    },
    openGraph: {
      title: content.title,
      ...(description !== undefined ? { description } : {}),
      type: "article",
    },
  };
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Jakarta",
});

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const content = await getPublishedContentBySlug(slug);

  if (!content) {
    notFound();
  }

  // The query guarantees type='ARTICLE' — no type map is needed.
  const [related, courseConnection] = await Promise.all([
    listRelatedArticles(content.id),
    getCourseConnectionForArticle(content.id),
  ]);

  const bodyHtml = renderTiptapHtml(content.body);
  const publishedLabel = dateFormatter.format(content.publishedAt);

  return (
    <article className={styles.page} aria-labelledby="article-title">
      <header className={styles.header}>
        <p className={styles.type}>Artikel</p>
        <h1 className={styles.title} id="article-title">
          {content.title}
        </h1>
        <p className={styles.published}>
          Diterbitkan {publishedLabel} WIB
        </p>
      </header>

      {/*
        bodyHtml is produced by renderTiptapHtml from the validated
        Tiptap JSON: every text/attribute boundary is escaped, node
        and mark names allowlisted, and URLs are http(s)-only.
      */}
      <div
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {related.length > 0 ? (
        <section className={styles.related} aria-labelledby="related-articles">
          <h2 className={styles.relatedTitle} id="related-articles">
            Artikel Terkait
          </h2>
          <ul className={styles.relatedGrid}>
            {related.map((article) => (
              <li key={article.id}>
                <Card className={styles.relatedCard}>
                  <h3 className={styles.relatedCardTitle}>
                    <Link href={`/articles/${article.slug}`}>
                      {article.title}
                    </Link>
                  </h3>
                  <p className={styles.relatedCardMeta}>
                    Diterbitkan {dateFormatter.format(article.publishedAt)} WIB
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {courseConnection !== null ? (
        <section
          className={styles.courseBand}
          aria-labelledby="article-course-cta"
        >
          <h2 className={styles.courseTitle} id="article-course-cta">
            Ingin mempelajari lebih lanjut?
          </h2>
          <p className={styles.courseTagline}>
            Jelajahi kursus terkait: {courseConnection.title}.
          </p>
          <div className={styles.courseActions}>
            <Link
              className={styles.courseLink}
              href={`/courses/${courseConnection.slug}`}
              aria-label={`Lihat kursus: ${courseConnection.title}`}
            >
              Lihat Kursus
            </Link>
          </div>
        </section>
      ) : null}
    </article>
  );
}
