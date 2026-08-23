import type { Metadata } from "next";

import { Card } from "@/components/ui/Card/Card";

import styles from "../page.module.scss";

/**
 * Admin questions placeholder (TASK 015).
 *
 * Shell-only page proving CMS navigation. Question bank
 * management belongs to later tasks.
 */
export const metadata: Metadata = {
  title: "Bank Soal",
};

export default function AdminQuestionsPage() {
  return (
    <section aria-labelledby="admin-questions-heading">
      <Card className={styles.card}>
        <h1 className={styles.title} id="admin-questions-heading">
          Bank Soal
        </h1>
        <p className={styles.intro}>
          Bank soal akan diimplementasikan pada tugas berikutnya.
        </p>
      </Card>
    </section>
  );
}
