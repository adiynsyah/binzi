import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentPreview } from "@/features/contents/components/ContentPreview/ContentPreview";
import { getContentById } from "@/features/contents/queries/getContent";

import styles from "../edit/page.module.scss";

/**
 * CMS Content Preview page (TASK 021, CMS Spec §16).
 *
 * Admin-only preview of one Content item, including DRAFT rows
 * ("Draft preview is available to admins only" — CMS §16). The
 * route lives inside the /admin tree, so src/proxy.ts (TASK 014)
 * rejects guests (307 to /login) and non-admin users (403) before
 * this component ever runs; there is deliberately NO public preview
 * route — "Draft content must never become publicly accessible
 * simply because a preview URL exists" (CMS §16), and the public
 * /articles/[slug] route stays ARTICLE+PUBLISHED-only (TASK 020B).
 *
 * Read-only: the page performs a single SELECT via getContentById
 * (UUID-guarded, loaded server-side) and renders. No mutation, no
 * publish call, no status/publishedAt change. Unknown or malformed
 * ids use the established notFound() behavior — and because 404
 * rendering precedes any content data, nothing about other rows
 * leaks through this page. Metadata is STATIC (no content data), so
 * draft titles cannot leak through metadata generation either.
 */
export const metadata: Metadata = {
  title: "Pratinjau Konten",
};

export default async function AdminContentPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const content = await getContentById(id);
  if (!content) {
    notFound();
  }

  return (
    <section aria-labelledby="admin-content-preview-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-content-preview-heading">
            Pratinjau Konten
          </h1>
          <p className={styles.intro}>{content.title}</p>
        </div>
        <Link
          className={styles.backLink}
          href={`/admin/contents/${content.id}/edit`}
        >
          ← Kembali ke Sunting
        </Link>
      </div>
      <ContentPreview content={content} />
    </section>
  );
}
