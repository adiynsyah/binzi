import { Badge } from "@/components/ui/Badge/Badge";
import { renderTiptapHtml } from "@/features/contents/lib/renderTiptapHtml";
import type { EditableContent } from "@/features/contents/schemas/content-edit.schema";

import styles from "./ContentPreview.module.scss";

/**
 * BINZI Content Preview (TASK 021, CMS Spec §16 "Content Preview",
 * Architecture Spec §24 ContentPreview component boundary).
 *
 * Admin-only, READ-ONLY presentation of one Content item rendered
 * "as closely as possible to the public experience" (CMS §16): the
 * article-like header and body mirror the public Article page, and
 * the body goes through the exact same TASK 020 allowlist renderer
 * (renderTiptapHtml) — no second rendering path, no new dependency.
 *
 * The preview banner makes the state unambiguous: a DRAFT preview
 * explicitly says the content is NOT publicly accessible, so the
 * page can never be mistaken for a published article. Rendering a
 * preview performs no database access at all — the caller (the
 * admin preview page) loads the row server-side.
 */

const TYPE_LABELS: Record<EditableContent["type"], string> = {
  ARTICLE: "Artikel",
  VIDEO: "Video",
  INFOGRAPHIC: "Infografis",
  TEXT: "Teks",
  TIP: "Tips",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Jakarta",
});

export function ContentPreview({ content }: { content: EditableContent }) {
  const isDraft = content.status === "DRAFT";

  // Same safe serialization path as the public Article page — the
  // allowlist/escaping guarantees of renderTiptapHtml apply here too.
  const bodyHtml = renderTiptapHtml(content.body);

  return (
    <div className={styles.preview}>
      <div className={styles.banner}>
        <span className={styles.bannerLabel}>Pratinjau Admin</span>
        <Badge tone={isDraft ? "warning" : "success"}>
          {isDraft ? "Draf" : "Terbit"}
        </Badge>
        <p className={styles.bannerNote}>
          {isDraft
            ? "Ini pratinjau admin — draf belum diterbitkan dan tidak dapat diakses publik."
            : "Ini pratinjau admin — konten ini sudah terbit dan dapat diakses publik."}
        </p>
      </div>
      <article className={styles.article} aria-labelledby="content-preview-title">
        <header className={styles.header}>
          <p className={styles.type}>{TYPE_LABELS[content.type]}</p>
          <h1 className={styles.title} id="content-preview-title">
            {content.title}
          </h1>
          <p className={styles.published}>
            {isDraft || content.publishedAt === null
              ? "Belum diterbitkan"
              : `Diterbitkan ${dateFormatter.format(content.publishedAt)} WIB`}
          </p>
        </header>
        {/*
          bodyHtml is produced by renderTiptapHtml from the stored
          Tiptap JSON: every text/attribute boundary is escaped, node
          and mark names allowlisted, and URLs are http(s)-only.
        */}
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </article>
    </div>
  );
}
