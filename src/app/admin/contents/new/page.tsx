import type { Metadata } from "next";
import Link from "next/link";

import { ContentCreateForm } from "@/features/contents/components/ContentCreateForm/ContentCreateForm";

import styles from "./page.module.scss";

/**
 * CMS Content Create (TASK 018, CMS Spec §14/§17).
 *
 * Server Component wrapper for the create form. Route-level ADMIN
 * protection is owned by src/proxy.ts (TASK 014 — /admin/:path*
 * covers /admin/contents/new); the mutation additionally authorizes
 * server-side. No data access happens here.
 */
export const metadata: Metadata = {
  title: "Konten Baru",
};

export default function AdminContentNewPage() {
  return (
    <section aria-labelledby="admin-content-new-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-content-new-heading">
            Konten Baru
          </h1>
          <p className={styles.intro}>
            Buat konten baru; konten disimpan sebagai draf.
          </p>
        </div>
        <Link className={styles.backLink} href="/admin/contents">
          ← Kembali ke Daftar Konten
        </Link>
      </div>
      <ContentCreateForm />
    </section>
  );
}
