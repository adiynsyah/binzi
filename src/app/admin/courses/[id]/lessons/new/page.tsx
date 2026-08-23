import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Card } from "@/components/ui/Card/Card";
import { LessonCreateForm } from "@/features/courses/components/LessonCreateForm/LessonCreateForm";
import { getCourseById } from "@/features/courses/queries/getCourse";
import { createLessonAction } from "@/features/courses/mutations/createLesson";

import styles from "./page.module.scss";

/**
 * CMS Lesson Create (TASK 025, CMS Spec §8; Architecture §5 route
 * /admin/courses/[courseId]/lessons/new — the folder is named [id],
 * the dynamic segment already used at this level by .../[id]/edit,
 * because Next.js requires matching segment names at one level).
 *
 * Server Component: loads the parent course server-side, renders 404
 * for unknown or malformed ids (getCourseById guards the UUID), and
 * binds the create action to the course id so the binding is never
 * client input. Route-level ADMIN protection is owned by
 * src/proxy.ts (TASK 014 — /admin/:path* covers this route); the
 * mutation additionally authorizes server-side.
 *
 * Published courses (Decisions Log #11 — a published course's lesson
 * structure is immutable in V1) get a locked, form-less page: no
 * create surface is rendered at all, and the mutation would reject
 * independently anyway (fail closed at both layers).
 */
export const metadata: Metadata = {
  title: "Pelajaran Baru",
};

export default async function AdminLessonNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await getCourseById(id);
  if (!course) {
    notFound();
  }

  const builderHref = `/admin/courses/${course.id}/edit`;

  if (course.status === "PUBLISHED") {
    return (
      <section aria-labelledby="admin-lesson-new-heading">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title} id="admin-lesson-new-heading">
              Pelajaran Baru
            </h1>
            <p className={styles.intro}>Kursus: {course.title}</p>
          </div>
          <Link className={styles.backLink} href={builderHref}>
            ← Kembali ke Course Builder
          </Link>
        </div>
        <Card className={styles.lockedCard}>
          <h2 className={styles.lockedTitle}>
            Struktur Pelajaran Terkunci
          </h2>
          <p className={styles.lockedText}>
            Kursus ini sudah terbit, sehingga pelajarannya tidak dapat
            ditambah di V1. Menambahkan pelajaran memerlukan alur
            penurunan versi kursus yang belum tersedia.
          </p>
          <Link
            href={builderHref}
            className={`${buttonStyles.button} ${buttonStyles.secondary}`}
          >
            Kembali ke Course Builder
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="admin-lesson-new-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-lesson-new-heading">
            Pelajaran Baru
          </h1>
          <p className={styles.intro}>
            Kursus: {course.title} — pelajaran disimpan sebagai draf dan
            ditambahkan di akhir daftar.
          </p>
        </div>
        <Link className={styles.backLink} href={builderHref}>
          ← Kembali ke Course Builder
        </Link>
      </div>
      <LessonCreateForm
        courseId={course.id}
        action={createLessonAction.bind(null, course.id)}
      />
    </section>
  );
}
