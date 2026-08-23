import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentEditForm } from "@/features/contents/components/ContentEditForm/ContentEditForm";
import { getContentById } from "@/features/contents/queries/getContent";
import { updateContentAction } from "@/features/contents/mutations/updateContent";

import styles from "./page.module.scss";

/**
 * CMS Content Edit (TASK 019, CMS Spec §14/§17).
 *
 * Server Component: loads the existing content server-side (no data
 * access in the client), renders 404 for unknown ids, and binds the
 * update action to the content id so the id is never client input.
 * Route-level ADMIN protection is owned by src/proxy.ts (TASK 014 —
 * /admin/:path* covers this route); the mutation additionally
 * authorizes server-side. Both DRAFT and PUBLISHED content may be
 * edited (Business Rules §4.5/§24, CMS §17); saving never changes
 * the status.
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
    </section>
  );
}
