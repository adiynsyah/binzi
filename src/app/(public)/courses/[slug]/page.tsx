import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { courseDifficulty } from "@/db/schema/enums";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { createClient } from "@/lib/supabase/server";
import { getPublishedCourseBySlug } from "@/features/courses/queries/getPublishedCourseBySlug";
import { getEnrollmentForUser } from "@/features/enrollment/queries/getEnrollmentForUser";
import { enrollCourse } from "@/features/enrollment/mutations/enrollCourse";

import styles from "./page.module.scss";

/**
 * Public Course Detail (TASK 039, UI/UX §7 "Course Detail", §8 "Course
 * Curriculum", §9 "Enrollment CTA"; Business Rules §5; Decisions Log #1;
 * CTA ladder completed by TASK 042).
 *
 * Route shape /courses/[slug] under the (public) group is fixed by UI/UX
 * §7 and the Blueprint §4 route map. Publication is enforced inside
 * getPublishedCourseBySlug (status='PUBLISHED' in the WHERE clause), so
 * a DRAFT course and an unknown slug render the same 404 — drafts are
 * never publicly distinguishable (UI/UX §44).
 *
 * Guests may view the full Course Detail and the lesson titles, with the
 * first lesson marked as the free preview (Decisions Log #1, UI/UX §8
 * guest view). The lock badges are a UX-only affordance: lessons render
 * as non-interactive rows because the learning experience route belongs
 * to TASK 045.
 *
 * CTA states follow the full UI/UX §9 ladder (TASK 042):
 * - guest → "Masuk untuk Mulai Belajar" → /login;
 * - authenticated not enrolled → "Mulai Kursus", a form submitting the
 *   enrollCourse server action (creates the enrollment, BR §8);
 * - enrolled (ACTIVE) → "Lanjutkan Kursus" → learning route;
 * - enrolled (COMPLETED) → "Tinjau Kursus" → learning route.
 * The learning route /courses/[slug]/learn is owned by TASK 045 and is
 * an honest 404 until then (the approved future-route pattern).
 */

type PageProps = {
  params: Promise<{ slug: string }>;
};

const DIFFICULTY_LABELS: Record<
  (typeof courseDifficulty.enumValues)[number],
  string
> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);
  return {
    title: course ? `${course.title} — BINZI` : "Kursus Tidak Ditemukan — BINZI",
  };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);

  if (!course) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const enrollment = user
    ? await getEnrollmentForUser(user.id, course.id)
    : null;

  const outcomeLessons = course.lessons.filter(
    (lesson) => lesson.description !== null,
  );

  // UI/UX §9 ladder — one shared derivation for header + closing band.
  const learnHref = `/courses/${course.slug}/learn`;
  const enrollAction = enrollCourse.bind(null, course.slug);

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <Badge>{DIFFICULTY_LABELS[course.difficulty]}</Badge>
        <h1 className={styles.title}>{course.title}</h1>
        <p className={styles.description}>{course.description}</p>
        <p className={styles.meta}>
          {course.lessons.length} pelajaran
          {course.estimatedDuration !== null
            ? ` · ${course.estimatedDuration} menit`
            : ""}
        </p>
        <div className={styles.headerActions}>
          {!user ? (
            <Link className={styles.ctaPrimary} href="/login">
              Masuk untuk Mulai Belajar
            </Link>
          ) : enrollment === null ? (
            <form action={enrollAction}>
              <Button type="submit">Mulai Kursus</Button>
            </form>
          ) : enrollment.status === "COMPLETED" ? (
            <Link className={styles.ctaPrimary} href={learnHref}>
              Tinjau Kursus
            </Link>
          ) : (
            <Link className={styles.ctaPrimary} href={learnHref}>
              Lanjutkan Kursus
            </Link>
          )}
        </div>
      </header>

      {outcomeLessons.length > 0 ? (
        <section aria-labelledby="course-outcomes">
          <h2 className={styles.sectionTitle} id="course-outcomes">
            Apa yang Akan Anda Pelajari
          </h2>
          <ul className={styles.outcomes}>
            {outcomeLessons.map((lesson) => (
              <li className={styles.outcomeItem} key={lesson.id}>
                {lesson.description}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="course-curriculum">
        <h2 className={styles.sectionTitle} id="course-curriculum">
          Kurikulum Kursus
        </h2>
        {course.lessons.length > 0 ? (
          <>
            <ol className={styles.curriculum}>
              {course.lessons.map((lesson, index) => (
                <li className={styles.lesson} key={lesson.id}>
                  <span className={styles.lessonTitle}>{lesson.title}</span>
                  {index === 0 ? (
                    <Badge tone="success">Pratinjau</Badge>
                  ) : (
                    <Badge>Terkunci</Badge>
                  )}
                </li>
              ))}
            </ol>
            <p className={styles.curriculumHint}>
              Pelajaran pertama tersedia untuk pratinjau. Masuk untuk membuka
              seluruh kursus.
            </p>
          </>
        ) : (
          <p className={styles.empty}>
            Belum ada pelajaran yang tersedia. Silakan kembali lagi nanti.
          </p>
        )}
      </section>

      <section aria-labelledby="course-cta" className={styles.ctaBand}>
        <h2 className={styles.ctaTitle} id="course-cta">
          Siap Mulai Kursus Ini?
        </h2>
        <p className={styles.ctaTagline}>
          Pelajari {course.title} langkah demi langkah di BINZI.
        </p>
        <div className={styles.ctaActions}>
          {!user ? (
            <Link className={styles.ctaPrimary} href="/login">
              Masuk untuk Mulai Belajar
            </Link>
          ) : enrollment === null ? (
            <form action={enrollAction}>
              <Button type="submit">Mulai Kursus</Button>
            </form>
          ) : enrollment.status === "COMPLETED" ? (
            <Link className={styles.ctaPrimary} href={learnHref}>
              Tinjau Kursus
            </Link>
          ) : (
            <Link className={styles.ctaPrimary} href={learnHref}>
              Lanjutkan Kursus
            </Link>
          )}
        </div>
      </section>
    </article>
  );
}
