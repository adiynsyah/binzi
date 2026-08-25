import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LessonContent } from "@/components/learning/LessonContent/LessonContent";
import { createClient } from "@/lib/supabase/server";
import { canAccessLesson } from "@/features/progress/queries/canAccessLesson";
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
 * only); the §11 lesson header ("Lesson X of Y", progress bar)
 * belongs to TASK 047, and quiz state to TASK 048+. Viewing this
 * page never writes lesson_progress (Decisions Log #12).
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

  return (
    <article className={styles.page}>
      <h1 className={styles.lessonTitle}>{access.lesson.title}</h1>
      <LessonContent items={contentItems} />
      {/* TASK 048 renders the quiz area below the Content list. */}
    </article>
  );
}
