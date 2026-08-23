import type { Metadata } from "next";

import { Card } from "@/components/ui/Card/Card";

import styles from "./page.module.scss";

/**
 * Admin CMS dashboard placeholder (TASK 015).
 *
 * The shell-only page proves CMS navigation. Dashboard widgets
 * (CMS Spec §4) belong to later tasks.
 */
export const metadata: Metadata = {
  title: "Dashboard",
};

export default function AdminDashboardPage() {
  return (
    <section aria-labelledby="admin-dashboard-heading">
      <Card className={styles.card}>
        <h1 className={styles.title} id="admin-dashboard-heading">
          Dashboard
        </h1>
        <p className={styles.intro}>
          Ringkasan CMS akan ditampilkan di sini pada tugas berikutnya.
        </p>
      </Card>
    </section>
  );
}
