import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LessonNav } from "@/components/learning/LessonNav/LessonNav";
import { createClient } from "@/lib/supabase/server";
import { getCourseForLearning } from "@/features/progress/queries/getCourseForLearning";

import styles from "./layout.module.scss";

/**
 * BINZI learning shell (TASK 045, Task Plan "Learning Layout"; UI/UX
 * §10 "Learning Experience" — desktop "Lesson navigation | Content",
 * mobile collapsible navigation; Blueprint §4 route group (learning),
 * §28 Learning Engine, §36 "Server determines access").
 *
 * This is the authenticated learning boundary. src/proxy.ts (TASK
 * 013) already redirects guests away from /courses/<slug>/learn/*
 * before rendering; the layout re-checks the session server-side
 * anyway (Blueprint §12 "middleware is not the only security
 * boundary") and then resolves the whole shell from ONE
 * authoritative query, getCourseForLearning (TASK 045), which
 * delegates the enrollment/publication boundary to getCourseProgress
 * (TASK 043): unknown slug, DRAFT course, and a not-enrolled user
 * are all null here → the same 404 (UI/UX §44). No client-controlled
 * identifier or status is ever trusted.
 *
 * The shell renders exactly the UI/UX §10 frame — header (BINZI
 * wordmark, course title, progress per §27) and the lesson
 * navigation beside the content slot. It deliberately renders NO
 * lesson content (TASK 046 renders Content in persisted order), NO
 * quiz state (TASK 048+), and NO detailed progress header (TASK
 * 047). Reading this shell never writes lesson_progress (Decisions
 * Log #12 — rows are created lazily by the lesson experience, not
 * by views).
 */

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function LearnLayout({ children, params }: LayoutProps) {
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

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Lewati ke konten utama
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link aria-label="BINZI — Beranda" className={styles.wordmark} href="/">
            BINZI
          </Link>
          <p className={styles.courseTitle}>{course.course.title}</p>
          <p className={styles.progress}>
            {course.completedLessonCount} dari {course.totalLessonCount}{" "}
            pelajaran selesai · {course.percent}%
          </p>
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.navigation}>
          <LessonNav courseSlug={course.course.slug} items={course.lessons} />
        </aside>
        <main className={styles.main} id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
