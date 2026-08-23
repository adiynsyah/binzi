import type { Metadata } from "next";

import { Card } from "@/components/ui/Card/Card";

import styles from "../page.module.scss";

/**
 * Admin contents placeholder (TASK 015).
 *
 * Shell-only page proving CMS navigation. The content list,
 * editor, and publishing workflow (CMS Spec §8+) arrive with
 * TASK 016+.
 */
export const metadata: Metadata = {
  title: "Konten",
};

export default function AdminContentsPage() {
  return (
    <section aria-labelledby="admin-contents-heading">
      <Card className={styles.card}>
        <h1 className={styles.title} id="admin-contents-heading">
          Konten
        </h1>
        <p className={styles.intro}>
          Manajemen konten akan diimplementasikan pada tugas berikutnya.
        </p>
      </Card>
    </section>
  );
}
