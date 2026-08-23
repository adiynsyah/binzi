import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentEditForm } from "@/features/contents/components/ContentEditForm/ContentEditForm";
import { PublishContentForm } from "@/features/contents/components/PublishContentForm/PublishContentForm";
import { getContentById } from "@/features/contents/queries/getContent";
import { publishContentAction } from "@/features/contents/mutations/publishContent";
import { updateContentAction } from "@/features/contents/mutations/updateContent";

import styles from "./page.module.scss";

/**
 * CMS Content Edit (TASK 019, CMS Spec §14/§17) + explicit Publish
 * panel (TASK 020, CMS Spec §18/§30).
 *
 * Server Component: loads the existing content server-side (no data
 * access in the client), renders 404 for unknown ids, and binds the
 * update/publish actions to the content id so the id is never client
 * input. Route-level ADMIN protection is owned by src/proxy.ts
 * (TASK 014 — /admin/:path* covers this route); both mutations
 * additionally authorize server-side. Both DRAFT and PUBLISHED content
 * may be edited (Business Rules §4.5/§24, CMS §17); saving never
 * changes the status. The publish panel renders only for DRAFT rows
 * (publishing is explicit — Business Rules §22; the action also
 * rejects already-published rows server-side).
 */
export const metadata: Metadata = {
  title: "Sunting Konten",
};

export default async function AdminContentEditPage({
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
    <section aria-labelledby="admin-content-edit-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-content-edit-heading">
            Sunting Konten
          </h1>
          <p className={styles.intro}>{content.title}</p>
        </div>
        <Link className={styles.backLink} href="/admin/contents">
          ← Kembali ke Daftar Konten
        </Link>
      </div>
      <ContentEditForm
        content={content}
        action={updateContentAction.bind(null, content.id)}
      />
      {content.status === "DRAFT" ? (
        <PublishContentForm
          action={publishContentAction.bind(null, content.id)}
        />
      ) : null}
    </section>
  );
}
