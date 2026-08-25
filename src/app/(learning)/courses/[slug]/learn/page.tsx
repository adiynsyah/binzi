import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCourseForLearning } from "@/features/progress/queries/getCourseForLearning";

import styles from "./page.module.scss";

/**
 * BINZI learning entry (TASK 045) — /courses/[slug]/learn.
 *
 * The Course Detail CTAs (TASK 042 "Lanjutkan Kursus" / "Tinjau
 * Kursus") land here. This page owns NO rendering of its own: it
 * resolves the CURRENT lesson from authoritative server-side data
 * and redirects to the canonical lesson URL
 * /courses/[slug]/learn/[lessonSlug], so the URL bar always names
 * the lesson actually being studied (shareable, refreshable, and
 * re-checked by canAccessLesson on every request).
 *
 * Current-lesson derivation (BR §9): the first lesson whose
 * authoritative lesson_progress status is not COMPLETED — the
 * learning frontier every enrolled user is standing on. When every
 * lesson is completed (enrollment COMPLETED, the "Tinjau Kursus"
 * state) the target is the LAST lesson — review, not a dead end.
 * Statuses come from getCourseForLearning (TASK 043 data, Decisions
 * Log #12: no row = NOT_STARTED), never from client input.
 *
 * A published course with zero published lessons renders an honest
 * empty state inside the shell instead of a redirect target that
 * cannot exist.
 */

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LearnPage({ params }: PageProps) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const course = await getCourseForLearning(user.id, slug);
  if (!course) {
    notFound();
  }

  const currentLesson =
    course.lessons.find((lesson) => lesson.status !== "COMPLETED") ??
    course.lessons[course.lessons.length - 1];

  if (!currentLesson) {
    return (
      <p className={styles.empty}>
        Belum ada pelajaran yang tersedia. Silakan kembali lagi nanti.
      </p>
    );
  }

  redirect(`/courses/${course.course.slug}/learn/${currentLesson.slug}`);
}
