import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { contentType } from "@/db/schema/enums";
import { renderTiptapHtml } from "@/features/contents/lib/renderTiptapHtml";
import { getPublishedContentBySlug } from "@/features/contents/queries/getPublishedContent";

import styles from "./page.module.scss";

/**
 * Public Article page (TASK 020, UI/UX Spec §28 "Article Experience",
 * Blueprint §34, Decisions Log #5).
 *
 * Route shape /articles/[slug] is fixed by the authoritative specs —
 * it is not an implementation choice. Publication status is enforced
 * inside the query (status = 'PUBLISHED'), so drafts and unknown
 * slugs are both 404 and indistinguishable publicly. Guests may view
 * published articles without logging in (Business Rules §5).
 *
 * Minimal V1 presentation per UI/UX §28: type, title, published
 * date, article body. Related Articles and the Course CTA belong to
 * later milestones; no article listing exists yet.
 */

type PageProps = {
  params: Promise<{ slug: string }>;
};

const TYPE_LABELS: Record<(typeof contentType.enumValues)[number], string> = {
  ARTICLE: "Artikel",
  VIDEO: "Video",
  INFOGRAPHIC: "Infografis",
  TEXT: "Teks",
  TIP: "Tips",
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublishedContentBySlug(slug);
  return {
    title: content ? `${content.title} — BINZI` : "Artikel Tidak Ditemukan — BINZI",
  };
}

export default async function PublicArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const content = await getPublishedContentBySlug(slug);

  if (!content) {
    notFound();
  }

  const bodyHtml = renderTiptapHtml(content.body);
  const publishedLabel = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(content.publishedAt);

  return (
    <article className={styles.article} aria-labelledby="article-title">
      <header className={styles.header}>
        <p className={styles.type}>{TYPE_LABELS[content.type]}</p>
        <h1 className={styles.title} id="article-title">
          {content.title}
        </h1>
        <p className={styles.published}>Diterbitkan {publishedLabel} WIB</p>
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
    </article>
  );
}
