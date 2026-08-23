import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseForm } from "@/features/courses/components/CourseForm/CourseForm";
import { getCourseById } from "@/features/courses/queries/getCourse";
import { updateCourseAction } from "@/features/courses/mutations/updateCourse";

import styles from "./page.module.scss";

/**
 * CMS Course Edit (TASK 023, CMS Spec §6/§7).
 *
 * Server Component: loads the existing course server-side (no data
 * access in the client), renders 404 for unknown or malformed ids,
 * and binds the update action to the course id so the id is never
 * client input. Route-level ADMIN protection is owned by src/proxy.ts
 * (TASK 014 — /admin/:path* covers this route); the mutation
 * additionally authorizes server-side. Both DRAFT and PUBLISHED
 * courses may be edited (Business Rules §24); saving never changes
 * the status. The Course Builder (lessons, ordering, final quiz,
 * publish) is TASK 024+ and is deliberately absent — there is no
 * publish panel and no preview link here.
 */
export const metadata: Metadata = {
  title: "Sunting Kursus",
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

  return (
    <section aria-labelledby="admin-course-edit-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-course-edit-heading">
            Sunting Kursus
          </h1>
          <p className={styles.intro}>{course.title}</p>
        </div>
        <Link className={styles.backLink} href="/admin/courses">
          ← Kembali ke Daftar Kursus
        </Link>
      </div>
      <CourseForm
        course={course}
        action={updateCourseAction.bind(null, course.id)}
      />
    </section>
  );
}
