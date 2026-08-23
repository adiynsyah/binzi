import type { Metadata } from "next";
import Link from "next/link";

import { CourseForm } from "@/features/courses/components/CourseForm/CourseForm";
import { createCourseAction } from "@/features/courses/mutations/createCourse";

import styles from "./page.module.scss";

/**
 * CMS Course Create (TASK 023, CMS Spec §6).
 *
 * Server Component wrapper for the metadata form — the TASK 022
 * "Tambah Kursus" CTA target, no longer a 404. The Course Builder
 * (lessons, ordering, final quiz, publish) is TASK 024+ and is
 * deliberately absent. Route-level ADMIN protection is owned by
 * src/proxy.ts (TASK 014 — /admin/:path* covers /admin/courses/new);
 * the mutation additionally authorizes server-side. No data access
 * happens here.
 */
export const metadata: Metadata = {
  title: "Kursus Baru",
};

export default function AdminCourseNewPage() {
  return (
    <section aria-labelledby="admin-course-new-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-course-new-heading">
            Kursus Baru
          </h1>
          <p className={styles.intro}>
            Buat kursus baru; kursus disimpan sebagai draf.
          </p>
        </div>
        <Link className={styles.backLink} href="/admin/courses">
          ← Kembali ke Daftar Kursus
        </Link>
      </div>
      <CourseForm action={createCourseAction} />
    </section>
  );
}
