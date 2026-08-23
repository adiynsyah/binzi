import type { Metadata } from "next";

import { Card } from "@/components/ui/Card/Card";

import styles from "../page.module.scss";

/**
 * Admin courses placeholder (TASK 015).
 *
 * Shell-only page proving CMS navigation. Course management
 * (CMS Spec §5–§7) belongs to later tasks.
 */
export const metadata: Metadata = {
  title: "Kursus",
};

export default function AdminCoursesPage() {
  return (
    <section aria-labelledby="admin-courses-heading">
      <Card className={styles.card}>
        <h1 className={styles.title} id="admin-courses-heading">
          Kursus
        </h1>
        <p className={styles.intro}>
          Manajemen kursus akan diimplementasikan pada tugas berikutnya.
        </p>
      </Card>
    </section>
  );
}
