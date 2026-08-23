import Link from "next/link";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";
import { LessonOrderList } from "../LessonOrderList/LessonOrderList";
import { deleteLessonAction } from "../../mutations/deleteLesson";
import { reorderLessonAction } from "../../mutations/reorderLesson";

import type { BuilderLesson } from "../../queries/getCourseLessons";

import styles from "./CourseLessonsPanel.module.scss";

/**
 * Course Builder "Lessons" panel (TASK 024, CMS Spec §7 / Blueprint
 * §23; ordering added by TASK 026, deletion by TASK 027).
 *
 * Server Component: renders the persisted course structure — lessons
 * in their explicit per-course sort_order (BR §3.2/§27). Lesson
 * create is TASK 025 (the "Tambah Pelajaran" CTA targets the
 * Architecture §5 route /admin/courses/[id]/lessons/new), ordering is
 * TASK 026 (drag-and-drop + accessible move up/down via
 * LessonOrderList and the bound reorderLessonAction), and deletion is
 * TASK 027 (draft lessons only — BR §3.4/§28 — via the bound
 * deleteLessonAction, confirmed client-side per CMS §33).
 *
 * While the course is PUBLISHED the structure is locked in V1
 * (Decisions Log #11: no adding, deleting, OR reordering Lessons on a
 * published Course): the DRAFT-only ordering/deletion UI is not
 * rendered at all — the list stays read-only — and each mutation
 * independently re-checks the course status under a lock server-side.
 * TASK 028: every lesson title (both the interactive and read-only
 * lists) links to the Lesson Editor for Content assignment. Titles
 * render as plain text nodes — no dangerouslySetInnerHTML anywhere
 * in the panel.
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
          dapat ditambah, dihapus, atau disusun ulang di V1.
        </p>
      ) : null}

      {lessons.length > 0 ? (
        isPublished ? (
          <>
            <ol className={styles.lessonList}>
              {lessons.map((lesson) => (
                <li key={lesson.id} className={styles.lessonItem}>
                  <Link
                    className={styles.lessonTitle}
                    href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
                  >
                    {lesson.title}
                  </Link>
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
              Urutan mengikuti posisi pelajaran yang tersimpan.
            </p>
          </>
        ) : (
          <>
            <LessonOrderList
              lessons={lessons}
              courseId={courseId}
              action={reorderLessonAction.bind(null, courseId)}
              deleteAction={deleteLessonAction.bind(null, courseId)}
            />
            <p className={styles.orderNote}>
              Susun urutan dengan menyeret pelajaran atau menggunakan tombol
              naik/turun; urutan tersimpan otomatis.
            </p>
          </>
        )
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
