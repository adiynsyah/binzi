import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge/Badge";
import { LessonContent } from "@/components/learning/LessonContent/LessonContent";
import { createClient } from "@/lib/supabase/server";
import { canAccessLesson } from "@/features/progress/queries/canAccessLesson";
import { getCourseForLearning } from "@/features/progress/queries/getCourseForLearning";
import { getLessonForLearning } from "@/features/progress/queries/getLessonForLearning";

import styles from "./page.module.scss";

/**
 * BINZI lesson page boundary (TASK 045, Task Plan "Learning Layout";
 * Blueprint §29 Lesson Access Function, §36 "Server determines
 * access"; UI/UX §10 content column).
 *
 * Every render of /courses/[slug]/learn/[lessonSlug] passes through
 * the ONE centralized gate — canAccessLesson (TASK 044; its checks
 * are NOT duplicated here): authenticated, enrolled, course and
 * lesson published, lesson belongs to this course, previous lesson
 * completed. Denials map to behaviors, never to leaked content:
 * - UNAUTHENTICATED → /login (unreachable behind the proxy + layout
 *   re-check; kept as the gate's own contract);
 * - LESSON_LOCKED → back to /courses/[slug]/learn, which resolves
 *   the learner's current (accessible) lesson — the next honest
 *   learning action instead of a dead end;
 * - NOT_FOUND / NOT_ENROLLED → 404, drafts indistinguishable
 *   (UI/UX §44; the same contract as the public course queries).
 *
 * TASK 046 renders the lesson's Content in persisted order below the
 * title (LessonContent + getLessonForLearning, PUBLISHED contents
 * only). TASK 047 adds the §11 lesson header — "Lesson X of Y"
 * position among PUBLISHED lessons, the course progress bar (§27:
 * simple, position-communicating, never gamified), and the completed
 * state of THIS lesson (a ✓ badge when lesson_progress says
 * COMPLETED — quiz flow itself is TASK 048+). Course name and the
 * §27 progress sentence live in the learning shell header above
 * (TASK 045), so they are not repeated here. Viewing this page never
 * writes lesson_progress (Decisions Log #12).
 */

type PageProps = {
  params: Promise<{ slug: string; lessonSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, lessonSlug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { title: "Pelajaran Tidak Ditemukan — BINZI" };
  }

  const access = await canAccessLesson(user.id, slug, lessonSlug);
  return {
    title: access.allowed
      ? `${access.lesson.title} — BINZI`
      : "Pelajaran Tidak Ditemukan — BINZI",
  };
}

export default async function LessonPage({ params }: PageProps) {
  const { slug, lessonSlug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const access = await canAccessLesson(user.id, slug, lessonSlug);
  if (!access.allowed) {
    if (access.reason === "UNAUTHENTICATED") {
      redirect("/login");
    }
    if (access.reason === "LESSON_LOCKED") {
      redirect(`/courses/${slug}/learn`);
    }
    notFound();
  }

  // The gate has already resolved this lesson server-side — the id
  // passed here never comes from client input (IDOR-safe by
  // construction). PUBLISHED contents only, persisted order.
  const contentItems = await getLessonForLearning(access.lesson.id);

  // §11 lesson header inputs, all derived from the authoritative
  // learning query (043 derivation through the 045 composition — no
  // second progress computation). Position is the index among
  // PUBLISHED lessons, NOT the raw sort_order: a DRAFT lesson holes
  // the published sequence, and the learner only ever sees the
  // published set (BR §38). The gate guarantees an enrollment exists,
  // so this cannot be null for an allowed lesson.
  const course = await getCourseForLearning(user.id, slug);
  const lessonIndex = course?.lessons.findIndex(
    (lesson) => lesson.slug === access.lesson.slug,
  );
  const hasPosition =
    course !== null && lessonIndex !== undefined && lessonIndex >= 0;
  const lessonStatus = hasPosition ? course.lessons[lessonIndex].status : null;

  return (
    <article className={styles.page}>
      <header className={styles.lessonHeader}>
        <div className={styles.lessonMetaRow}>
          {hasPosition ? (
            <p className={styles.lessonMeta}>
              Pelajaran {lessonIndex + 1} dari {course.totalLessonCount}
            </p>
          ) : null}
          {lessonStatus === "COMPLETED" ? (
            <Badge tone="success" className={styles.completedBadge}>
              <span aria-hidden="true">✓</span> Selesai
            </Badge>
          ) : null}
        </div>
        <h1 className={styles.lessonTitle}>{access.lesson.title}</h1>
        {course !== null ? (
          <div
            className={styles.progress}
            role="progressbar"
            aria-valuenow={course.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progres kursus"
          >
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${course.percent}%` }}
              />
            </div>
            <p className={styles.progressLabel}>{course.percent}%</p>
          </div>
        ) : null}
      </header>
      <LessonContent items={contentItems} />
      {/* UI/UX §17 — the completion CTA leads to the Lesson Quiz
          (TASK 049); the quiz page re-checks access through the ONE
          centralized quiz gate canAccessLessonQuiz (TASK 048). */}
      <aside aria-labelledby="lesson-quiz-cta-title" className={styles.quizCta}>
        <h2 className={styles.quizCtaTitle} id="lesson-quiz-cta-title">
          Siap menguji pemahaman Anda?
        </h2>
        <Link
          className={styles.quizCtaLink}
          href={`/courses/${slug}/learn/${access.lesson.slug}/quiz`}
        >
          Kerjakan Kuis
        </Link>
      </aside>
    </article>
  );
}
