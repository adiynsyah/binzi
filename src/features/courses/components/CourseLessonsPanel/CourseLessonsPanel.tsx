import Link from "next/link";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";

import type { BuilderLesson } from "../../queries/getCourseLessons";

import styles from "./CourseLessonsPanel.module.scss";

/**
 * Course Builder "Lessons" panel (TASK 024, CMS Spec §7 / Blueprint §23).
 *
 * Server Component: renders the persisted course structure — lessons in
 * their explicit per-course sort_order (BR §3.2/§27). TASK 024 is the
 * builder shell, so this panel is deliberately read-only: lesson create
 * is TASK 025 (the "Tambah Pelajaran" CTA points at the Architecture §5
 * route /admin/courses/[id]/lessons/new and 404s until then — the same
 * approved CTA convention as TASK 016/022), drag-and-drop reordering is
 * TASK 026, and deletion is TASK 027. There are no per-row controls.
 *
 * While the course is PUBLISHED the structure is locked in V1 (Decisions
 * Log #11: no adding or deleting Lessons on a published Course), so the
 * CTA is hidden and a lock note is shown instead. Lesson titles render
 * as plain text — no dangerouslySetInnerHTML anywhere in the panel.
 */

type CourseLessonsPanelProps = {
  courseId: string;
  courseStatus: BuilderLesson["status"];
  lessons: BuilderLesson[];
};

const STATUS_LABELS: Record<BuilderLesson["status"], string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

export function CourseLessonsPanel({
  courseId,
  courseStatus,
  lessons,
}: CourseLessonsPanelProps) {
  const isPublished = courseStatus === "PUBLISHED";

  return (
    <section
      className={styles.panel}
      aria-labelledby="course-builder-lessons-heading"
    >
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle} id="course-builder-lessons-heading">
          Pelajaran
        </h2>
        {isPublished ? null : (
          <Link
            href={`/admin/courses/${courseId}/lessons/new`}
            className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.addCta}`}
          >
            Tambah Pelajaran
          </Link>
        )}
      </div>

      {isPublished ? (
        <p className={styles.lockedNote}>
          Kursus ini sudah terbit — struktur pelajaran terkunci dan tidak
          dapat ditambah atau dihapus di V1.
        </p>
      ) : null}

      {lessons.length > 0 ? (
        <>
          <ol className={styles.lessonList}>
            {lessons.map((lesson) => (
              <li key={lesson.id} className={styles.lessonItem}>
                <span className={styles.lessonTitle}>{lesson.title}</span>
                <Badge
                  tone={
                    lesson.status === "PUBLISHED" ? "success" : "warning"
                  }
                >
                  {STATUS_LABELS[lesson.status]}
                </Badge>
              </li>
            ))}
          </ol>
          <p className={styles.orderNote}>
            Urutan mengikuti posisi pelajaran yang tersimpan; penyusunan
            ulang pelajaran (seret-lepas) tersedia pada tugas berikutnya.
          </p>
        </>
      ) : (
        <Card className={styles.emptyPanel}>
          <h3 className={styles.emptyTitle}>Belum ada pelajaran.</h3>
          <p className={styles.emptyText}>
            {isPublished
              ? "Kursus terbit ini belum memiliki pelajaran."
              : "Tambahkan pelajaran pertama untuk menyusun materi kursus ini."}
          </p>
        </Card>
      )}
    </section>
  );
}
