import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card/Card";
import { listPublishedArticlesForCatalog } from "@/features/contents/queries/listPublishedArticlesForCatalog";

import styles from "./page.module.scss";

/**
 * Public Article Catalog (TASK 040, Business Rules §5 "Browse published
 * Articles", Blueprint §4 route map — articles/ lives under (public)).
 *
 * No UI/UX section defines an article-listing structure (§28 covers the
 * article DETAIL page), so the page composes the TASK 038 course-catalog
 * layout and the TASK 037 featured-article card — the only approved
 * article-card precedent (type label, title link, published date).
 * Search/filter/pagination are NOT implemented: no source requires them
 * for articles (UI/UX §6 search is Course-catalog-specific) — FLAG.
 *
 * Publication safety: listPublishedArticlesForCatalog enforces
 * type='ARTICLE' + status='PUBLISHED' + slug IS NOT NULL inside the
 * query, so drafts and slug-less rows can never render here (UI/UX §44,
 * Blueprint §34). Guests may browse without logging in (BR §5).
 *
 * Cards link to /articles/[slug] — live since TASK 020 (rebuilt under
 * the shell by TASK 041).
 */

export const metadata: Metadata = {
  title: "Artikel",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Jakarta",
});

export default async function ArticlesPage() {
  const articles = await listPublishedArticlesForCatalog();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Artikel</h1>
        <p className={styles.description}>
          Baca artikel gizi pilihan dari BINZI.
        </p>
      </header>

      {articles.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            Belum ada artikel yang tersedia.
          </p>
          <p className={styles.emptyHint}>Silakan kembali lagi nanti.</p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {articles.map((article) => (
            <li key={article.id}>
              <Card className={styles.articleCard}>
                <p className={styles.articleType}>Artikel</p>
                <h2 className={styles.cardTitle}>
                  <Link href={`/articles/${article.slug}`}>{article.title}</Link>
                </h2>
                <p className={styles.cardMeta}>
                  Diterbitkan {dateFormatter.format(article.publishedAt)} WIB
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
