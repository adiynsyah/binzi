import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { courseDifficulty } from "@/db/schema/enums";
import { Badge } from "@/components/ui/Badge/Badge";
import { createClient } from "@/lib/supabase/server";
import { getPublishedCourseBySlug } from "@/features/courses/queries/getPublishedCourseBySlug";

import styles from "./page.module.scss";

/**
 * Public Course Detail (TASK 039, UI/UX §7 "Course Detail", §8 "Course
 * Curriculum", §9 "Enrollment CTA"; Business Rules §5; Decisions Log #1).
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
 * as non-interactive rows because no public lesson URL exists in V1 —
 * the learning experience route belongs to later milestones.
 *
 * CTA states follow the UI/UX §9 ladder as far as V1 progress allows:
 * guests get "Login to Start Learning" (Business Rules §5 flow: preview
 * → login required → full access); authenticated not-enrolled users get
 * "Start Course". Continue/Review states require enrollment data that
 * no earlier task produces, so they are not rendered here (FLAG).
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

  const outcomeLessons = course.lessons.filter(
    (lesson) => lesson.description !== null,
  );

  const startHref = user ? `/courses/${course.slug}/learn` : "/login";
  const startLabel = user ? "Mulai Kursus" : "Masuk untuk Mulai Belajar";

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
          <Link className={styles.ctaPrimary} href={startHref}>
            {startLabel}
          </Link>
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
          <Link className={styles.ctaPrimary} href={startHref}>
            {startLabel}
          </Link>
        </div>
      </section>
    </article>
  );
}
