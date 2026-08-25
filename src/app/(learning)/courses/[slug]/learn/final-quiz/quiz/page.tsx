import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { QuizPlayer } from "@/components/learning/QuizPlayer/QuizPlayer";
import { createClient } from "@/lib/supabase/server";
import { canAccessFinalQuiz } from "@/features/quizzes/queries/canAccessFinalQuiz";
import { getQuizForPlayer } from "@/features/quizzes/queries/getQuizForPlayer";
import { submitFinalQuiz } from "@/features/quizzes/mutations/submitFinalQuiz";

import styles from "./page.module.scss";

/**
 * BINZI Final Quiz page boundary (TASK 055, Task Plan "Final Quiz
 * Access"; UI/UX §18–§20 via the shared player; Blueprint §30).
 *
 * Route: /courses/[slug]/learn/final-quiz/quiz — the player page the
 * §25 ready screen's CTA opens. Every render passes through the ONE
 * centralized Final Quiz gate — canAccessFinalQuiz (TASK 048); its
 * all-lessons-completed derivation (getCourseProgress over the
 * published set, BR §17/§38) is NOT duplicated here. Denials behave
 * exactly like the ready page's (and the lesson quiz page's):
 * - UNAUTHENTICATED → /login;
 * - FINAL_QUIZ_LOCKED → /courses/[slug]/learn (the frontier resolver);
 * - NOT_FOUND / NOT_ENROLLED / QUIZ_NOT_FOUND → 404, unknown and
 *   DRAFT indistinguishable (UI/UX §44).
 *
 * The quiz id comes only from the gate's server-side payload
 * (IDOR-safe by construction), and getQuizForPlayer carries the
 * questions in persisted order WITHOUT correctness — is_correct never
 * reaches the client (Architecture §19). Rendering writes nothing.
 *
 * The player is the SAME QuizPlayer as the lesson quizzes (no second
 * player): submitFinalQuiz (bound to the course slug) reuses the 050
 * scorer and the 051 transactional persistence, and the two
 * lesson-specific result sentences are swapped for Final-Quiz-truthful
 * copy — a passed Final Quiz completes NO lesson (BR §17; course
 * completion is TASK 057), its §23 review target is the learning hub
 * (the whole course), and with no next lesson the pass CTA falls back
 * to the hub. Unlimited attempts (BR §13/§16); retry policy is TASK
 * 053's unchanged behavior.
 */
type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { title: "Halaman Tidak Ditemukan — BINZI" };
  }

  const access = await canAccessFinalQuiz(user.id, slug);
  return {
    title: access.allowed
      ? "Kuis Akhir — BINZI"
      : "Halaman Tidak Ditemukan — BINZI",
  };
}

export default async function FinalQuizPage({ params }: PageProps) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const access = await canAccessFinalQuiz(user.id, slug);
  if (!access.allowed) {
    if (access.reason === "UNAUTHENTICATED") {
      redirect("/login");
    }
    if (access.reason === "FINAL_QUIZ_LOCKED") {
      redirect(`/courses/${slug}/learn`);
    }
    notFound();
  }

  // The gate resolved this quiz server-side — the id passed here
  // never comes from client input (IDOR-safe by construction).
  const questions = await getQuizForPlayer(access.quiz.id);
  const learnBase = `/courses/${slug}/learn`;

  return (
    <article className={styles.page}>
      <header className={styles.quizHeader}>
        <h1 className={styles.quizTitle}>Kuis Akhir</h1>
      </header>
      <QuizPlayer
        action={submitFinalQuiz.bind(null, slug)}
        questions={questions}
        quizHref={`${learnBase}/final-quiz/quiz`}
        lessonHref={learnBase}
        nextLessonHref={null}
        learnHubHref={learnBase}
        passedNote="Anda lulus Kuis Akhir ini."
        retryHint="Pelajari kembali pelajaran kursus ini, lalu coba lagi."
      />
    </article>
  );
}
