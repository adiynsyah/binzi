import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge/Badge";
import { CourseForm } from "@/features/courses/components/CourseForm/CourseForm";
import { CourseLessonsPanel } from "@/features/courses/components/CourseLessonsPanel/CourseLessonsPanel";
import { getCourseLessons } from "@/features/courses/queries/getCourseLessons";
import { getCourseById } from "@/features/courses/queries/getCourse";
import { updateCourseAction } from "@/features/courses/mutations/updateCourse";

import styles from "./page.module.scss";

/**
 * CMS Course Edit + Course Builder (TASK 023, CMS Spec §6; TASK 024,
 * CMS Spec §7 / Blueprint §23).
 *
 * Server Component: loads the course and its ordered lessons
 * server-side (no data access in the client), renders 404 for unknown
 * or malformed ids, and binds the update action to the course id so
 * the id is never client input. Route-level ADMIN protection is owned
 * by src/proxy.ts (TASK 014 — /admin/:path* covers this route); the
 * mutation additionally authorizes server-side. Both DRAFT and
 * PUBLISHED courses may be edited (Business Rules §24); saving never
 * changes the status.
 *
 * TASK 024 adds the builder experience around the TASK 023 metadata
 * form, mirroring the CMS §7 editor layout:
 *   - header publish state (Badge, per Blueprint §23 "Publish state";
 *     the course publish/unpublish workflow itself is a later task —
 *     BR §3.1 gates it on published, valid lessons and quizzes),
 *   - Course Information (the TASK 023 form),
 *   - Lessons (read-only ordered list; create/reorder/delete are
 *     TASK 025/026/027),
 *   - Final Quiz (placeholder panel; its builder is TASK 034).
 * There is deliberately no publish button and no preview link here.
 */
export const metadata: Metadata = {
  title: "Sunting Kursus",
};

type CourseStatus = "DRAFT" | "PUBLISHED";

const STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

export default async function AdminCourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await getCourseById(id);
  if (!course) {
    notFound();
  }

  const lessons = await getCourseLessons(course.id);

  return (
    <section aria-labelledby="admin-course-edit-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-course-edit-heading">
            Sunting Kursus
          </h1>
          <div className={styles.introRow}>
            <p className={styles.intro}>{course.title}</p>
            <Badge
              tone={course.status === "PUBLISHED" ? "success" : "warning"}
            >
              {STATUS_LABELS[course.status]}
            </Badge>
          </div>
        </div>
        <Link className={styles.backLink} href="/admin/courses">
          ← Kembali ke Daftar Kursus
        </Link>
      </div>

      <h2 className={styles.infoHeading} id="course-information-heading">
        Informasi Kursus
      </h2>
      <CourseForm
        course={course}
        action={updateCourseAction.bind(null, course.id)}
      />

      <CourseLessonsPanel
        courseId={course.id}
        courseStatus={course.status}
        lessons={lessons}
      />

      <section
        className={styles.finalQuizPanel}
        aria-labelledby="course-builder-final-quiz-heading"
      >
        <h2
          className={styles.finalQuizTitle}
          id="course-builder-final-quiz-heading"
        >
          Kuis Akhir
        </h2>
        <p className={styles.finalQuizNote}>
          Kuis akhir dikonfigurasi melalui Bank Soal setelah pelajaran dan
          kuis pelajaran selesai disusun (tugas berikutnya).
        </p>
      </section>
    </section>
  );
}
