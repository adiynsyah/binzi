import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";
import { LessonContentPanel } from "@/features/courses/components/LessonContentPanel/LessonContentPanel";
import { assignContentToLessonAction } from "@/features/courses/mutations/assignContentToLesson";
import { reorderLessonContentAction } from "@/features/courses/mutations/reorderLessonContent";
import { getCourseById } from "@/features/courses/queries/getCourse";
import {
  getLessonContents,
  getLessonForEditor,
} from "@/features/courses/queries/getLessonForEditor";
import { searchAssignableContents } from "@/features/courses/queries/searchAssignableContents";
import { parseLessonContentSearchParams } from "@/features/courses/schemas/lesson-content-search.schema";

import styles from "./page.module.scss";

/**
 * CMS Lesson Editor (TASK 028, CMS Spec §9; assignment per §10/§11).
 *
 * Server Component: loads the course and the lesson server-side and
 * renders 404 for unknown, malformed, OR cross-course ids —
 * getLessonForEditor matches on (course_id, id), so a lesson outside
 * this course's route context can never render (IDOR-safe). Route
 * level ADMIN protection is owned by src/proxy.ts (TASK 014 —
 * /admin/:path* covers this route); the mutation additionally
 * authorizes server-side.
 *
 * Layout per CMS §9: Basic Information (read-only display — lesson
 * metadata editing is not part of TASK 028), Content (assigned list +
 * assignment search from TASK 028; drag-and-drop ordering with the
 * accessible Naik/Turun fallback from TASK 029), Lesson Quiz
 * (placeholder — its builder is a later task), and the publish state
 * as the header Badge. While the course is PUBLISHED the structure is
 * locked in V1 (Decisions Log #11): the ordering controls and the
 * search/add surface are not rendered at all and the mutations would
 * reject independently anyway (fail closed at both layers).
 *
 * Search state lives in the URL (q / page) — shareable views, plain
 * GET form, no client data access. The mutation's actionable
 * rejection feedback also lives in the URL (?error=…) and renders as
 * an inline alert.
 */
export const metadata: Metadata = {
  title: "Editor Pelajaran",
};

type CourseStatus = "DRAFT" | "PUBLISHED";

const STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

/** Rejection flags the mutation may set (anything else is ignored). */
const ERROR_FLAGS = new Set(["assigned", "missing", "locked", "invalid"]);

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminLessonEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, lessonId } = await params;

  const course = await getCourseById(id);
  if (!course) {
    notFound();
  }

  const lesson = await getLessonForEditor(course.id, lessonId);
  if (!lesson) {
    // Unknown, malformed, or belonging to another course — one 404.
    notFound();
  }

  const builderHref = `/admin/courses/${course.id}/edit`;
  const isPublished = course.status === "PUBLISHED";

  const query = parseLessonContentSearchParams(await searchParams);
  const rawError = firstValue((await searchParams).error);
  const error =
    typeof rawError === "string" && ERROR_FLAGS.has(rawError)
      ? rawError
      : undefined;

  const assigned = await getLessonContents(lesson.id);

  // The search surface only exists for DRAFT courses (Decisions #11).
  let search: Awaited<ReturnType<typeof searchAssignableContents>> | null =
    null;
  let searchFailed = false;
  if (!isPublished) {
    try {
      search = await searchAssignableContents(query);
    } catch (error) {
      // Detailed errors belong in server logs (CMS §45).
      console.error("[admin/lesson-editor] search query failed:", error);
      searchFailed = true;
    }
  }

  return (
    <section aria-labelledby="admin-lesson-editor-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-lesson-editor-heading">
            Editor Pelajaran
          </h1>
          <div className={styles.introRow}>
            <p className={styles.intro}>
              {lesson.title} — Kursus: {course.title}
            </p>
            <Badge tone={lesson.status === "PUBLISHED" ? "success" : "warning"}>
              {STATUS_LABELS[lesson.status]}
            </Badge>
          </div>
        </div>
        <Link className={styles.backLink} href={builderHref}>
          ← Kembali ke Course Builder
        </Link>
      </div>

      <section
        className={styles.infoPanel}
        aria-labelledby="lesson-info-heading"
      >
        <h2 className={styles.infoTitle} id="lesson-info-heading">
          Informasi Dasar
        </h2>
        <Card className={styles.infoCard}>
          <p className={styles.infoText}>
            {lesson.description ?? "Tanpa deskripsi."}
          </p>
        </Card>
      </section>

      <LessonContentPanel
        courseId={course.id}
        lessonId={lesson.id}
        courseStatus={course.status}
        assigned={assigned}
        search={search}
        searchFailed={searchFailed}
        searchQuery={query}
        error={error}
        action={assignContentToLessonAction.bind(null, course.id, lesson.id)}
        reorderAction={reorderLessonContentAction.bind(
          null,
          course.id,
          lesson.id,
        )}
      />

      <section
        className={styles.quizPanel}
        aria-labelledby="lesson-quiz-heading"
      >
        <h2 className={styles.quizTitle} id="lesson-quiz-heading">
          Kuis Pelajaran
        </h2>
        <p className={styles.quizNote}>
          Kuis pelajaran dikonfigurasi melalui Bank Soal setelah konten
          pelajaran selesai disusun (tugas berikutnya).
        </p>
      </section>
    </section>
  );
}
