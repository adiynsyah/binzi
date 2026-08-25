import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { QuizPlayer } from "@/components/learning/QuizPlayer/QuizPlayer";
import { createClient } from "@/lib/supabase/server";
import { canAccessLessonQuiz } from "@/features/quizzes/queries/canAccessLessonQuiz";
import { getQuizForPlayer } from "@/features/quizzes/queries/getQuizForPlayer";
import { submitLessonQuiz } from "@/features/quizzes/mutations/submitLessonQuiz";
import { getCourseForLearning } from "@/features/progress/queries/getCourseForLearning";

import styles from "./page.module.scss";

/**
 * BINZI lesson quiz page boundary (TASK 049, Task Plan "Quiz Player";
 * UI/UX §18–§20; Blueprint §28 Learning Engine).
 *
 * Every render of /courses/[slug]/learn/[lessonSlug]/quiz passes
 * through the ONE centralized quiz gate — canAccessLessonQuiz (TASK
 * 048, itself delegating to canAccessLesson 044; its checks are NOT
 * duplicated here). Denials map to behaviors, never leaked content:
 * - UNAUTHENTICATED → /login (unreachable behind the proxy + gate;
 *   kept as the gate's own contract);
 * - LESSON_LOCKED → back to /courses/[slug]/learn, which resolves
 *   the learner's current lesson — the same honest redirect the
 *   lesson page uses (TASK 045);
 * - NOT_FOUND / NOT_ENROLLED / QUIZ_NOT_FOUND → 404, unknown and
 *   DRAFT indistinguishable (UI/UX §44); a lesson without a
 *   materialized quiz row is a plain 404, fail-closed.
 *
 * The quiz id comes only from the gate's server-side payload. The
 * player data (getQuizForPlayer) carries questions and options in
 * persisted order WITHOUT correctness — is_correct never reaches the
 * client (Architecture §19; scoring is TASK 050). Rendering this page
 * writes nothing: no lesson_progress, no attempts (Decisions Log #12).
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
    return { title: "Halaman Tidak Ditemukan — BINZI" };
  }

  const access = await canAccessLessonQuiz(user.id, slug, lessonSlug);
  return {
    title: access.allowed
      ? `Kuis: ${access.lesson.title} — BINZI`
      : "Halaman Tidak Ditemukan — BINZI",
  };
}

export default async function LessonQuizPage({ params }: PageProps) {
  const { slug, lessonSlug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const access = await canAccessLessonQuiz(user.id, slug, lessonSlug);
  if (!access.allowed) {
    if (access.reason === "UNAUTHENTICATED") {
      redirect("/login");
    }
    if (access.reason === "LESSON_LOCKED") {
      redirect(`/courses/${slug}/learn`);
    }
    notFound();
  }

  // The gate resolved this quiz server-side — the id passed here
  // never comes from client input (IDOR-safe by construction).
  const questions = await getQuizForPlayer(access.quiz.id);

  // TASK 052 — the result screen's next-action targets (UI/UX §21),
  // computed server-side over the PUBLISHED lesson set in persisted
  // order — the same ordering the learning shell navigates by. The
  // passed lesson's successor links onward; the last lesson falls
  // back to the learning hub. Read-only: no progress is written by
  // this render.
  const course = await getCourseForLearning(user.id, slug);
  const lessonIndex = course?.lessons.findIndex((l) => l.slug === lessonSlug) ?? -1;
  const nextLessonSlug =
    course !== null && lessonIndex >= 0
      ? (course.lessons[lessonIndex + 1]?.slug ?? null)
      : null;
  const learnBase = `/courses/${slug}/learn`;

  return (
    <article className={styles.page}>
      <header className={styles.quizHeader}>
        <h1 className={styles.quizTitle}>Kuis Pelajaran</h1>
      </header>
      <QuizPlayer
        action={submitLessonQuiz.bind(null, slug, lessonSlug)}
        questions={questions}
        quizHref={`${learnBase}/${lessonSlug}/quiz`}
        nextLessonHref={nextLessonSlug ? `${learnBase}/${nextLessonSlug}` : null}
        learnHubHref={learnBase}
      />
    </article>
  );
}
