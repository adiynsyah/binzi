import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canAccessFinalQuiz } from "@/features/quizzes/queries/canAccessFinalQuiz";
import { getQuizForPlayer } from "@/features/quizzes/queries/getQuizForPlayer";

import styles from "./page.module.scss";

/**
 * BINZI Final Quiz ready page (TASK 055, Task Plan "Final Quiz Access
 * — Unlock Final Quiz only after all Lessons complete"; UI/UX §25
 * "Final Quiz UX"; Blueprint §30 "Final Quiz Access Function").
 *
 * Route: /courses/[slug]/learn/final-quiz — the §25 pre-quiz screen.
 * Every render passes through the ONE centralized Final Quiz gate —
 * canAccessFinalQuiz (TASK 048), which derives all-lessons-completed
 * from getCourseProgress over the LATEST PUBLISHED lesson set (BR
 * §17/§38) and checks it BEFORE quiz resolution. Denials map to
 * behaviors, never leaked structure:
 * - UNAUTHENTICATED → /login (proxy-covered contract);
 * - FINAL_QUIZ_LOCKED → back to /courses/[slug]/learn, the hub that
 *   resolves the learner's frontier lesson — the same honest redirect
 *   the locked lesson/quiz pages use (TASK 044/045/049; §24's
 *   explain-why is the hub's own "continue where you are");
 * - NOT_FOUND / NOT_ENROLLED / QUIZ_NOT_FOUND → 404, unknown and
 *   DRAFT indistinguishable (UI/UX §44); a course whose Final Quiz
 *   row was never materialized is a plain 404, fail-closed.
 *
 * The body renders exactly §25's milestone screen: the all-lessons
 * celebration, the ready question, the server-resolved question
 * count and the 80% passing score (BR §19), and ONE 44px CTA into
 * the quiz page. Rendering writes nothing — no lesson_progress, no
 * attempts (Decisions Log #12); the quiz id stays server-side, and
 * the question count is the only quiz data surfaced here.
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

export default async function FinalQuizReadyPage({ params }: PageProps) {
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

  // Server-resolved quiz only (the gate's payload); the count is the
  // sole data this screen needs — questions themselves load on the
  // quiz page, still without correctness.
  const questions = await getQuizForPlayer(access.quiz.id);

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.celebration}>
          Anda telah menyelesaikan semua pelajaran!
        </p>
        <h1 className={styles.title}>Siap untuk Kuis Akhir?</h1>
      </header>
      <p className={styles.facts}>
        {questions.length} soal · Nilai kelulusan: 80%
      </p>
      <Link className={styles.startCta} href={`/courses/${slug}/learn/final-quiz/quiz`}>
        Mulai Kuis Akhir
      </Link>
    </article>
  );
}
