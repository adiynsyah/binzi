import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";
import { LessonContentPanel } from "@/features/courses/components/LessonContentPanel/LessonContentPanel";
import { PublishForm } from "@/features/courses/components/PublishForm/PublishForm";
import { assignContentToLessonAction } from "@/features/courses/mutations/assignContentToLesson";
import { publishLessonAction } from "@/features/courses/mutations/publishLesson";
import { reorderLessonContentAction } from "@/features/courses/mutations/reorderLessonContent";
import { getCourseById } from "@/features/courses/queries/getCourse";
import {
  getLessonContents,
  getLessonForEditor,
} from "@/features/courses/queries/getLessonForEditor";
import { searchAssignableContents } from "@/features/courses/queries/searchAssignableContents";
import type { PublishCheck } from "@/features/courses/schemas/publish.schema";
import { parseLessonContentSearchParams } from "@/features/courses/schemas/lesson-content-search.schema";
import { getLessonQuizPublishChecks } from "@/features/quizzes/services/quiz.service";
import { LessonQuizPanel } from "@/features/quizzes/components/LessonQuizPanel/LessonQuizPanel";
import { addQuestionToLessonQuizAction } from "@/features/quizzes/mutations/addQuestionToLessonQuiz";
import { removeQuestionFromLessonQuizAction } from "@/features/quizzes/mutations/removeQuestionFromLessonQuiz";
import { reorderQuizQuestionAction } from "@/features/quizzes/mutations/reorderQuizQuestion";
import {
  getLessonQuiz,
  getQuizQuestions,
} from "@/features/quizzes/queries/getLessonQuizForEditor";
import { searchBankQuestions } from "@/features/quizzes/queries/searchBankQuestions";
import { parseLessonQuizSearchParams } from "@/features/quizzes/schemas/lesson-quiz-search.schema";

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
 * accessible Naik/Turun fallback from TASK 029), Lesson Quiz (the
 * TASK 033 builder — select/reorder/remove Questions with the N / 10
 * display-only status), and the publish state as the header Badge.
 * While the course is PUBLISHED the structure is locked in V1
 * (Decisions Log #11): the ordering controls and the search/add
 * surfaces of BOTH panels are not rendered at all and the mutations
 * would reject independently anyway (fail closed at both layers).
 *
 * Search state lives in the URL — the Content picker under q / page
 * and the Lesson Quiz picker under its own qq / qpage (TASK 033), so
 * both filters coexist in one shareable URL via plain GET forms. The
 * mutations' actionable rejection feedback is panel-scoped the same
 * way (?error=… renders in the Content panel, ?quizError=… in the
 * Lesson Quiz panel) so a rejection never shows an unrelated
 * cross-panel message.
 *
 * TASK 035 adds the explicit Lesson Publish section (CMS §19/§30):
 * for DRAFT lessons the page renders the shared PublishForm with a
 * readiness checklist computed from the same loaded data plus the
 * centralized quiz service — guidance only, the publishLesson action
 * re-validates the persisted state under locks and is the authority
 * (BR §32). PUBLISHED lessons show the badge and no form; the action
 * independently rejects republishing and course-level locking.
 */
export const metadata: Metadata = {
  title: "Editor Pelajaran",
};

type CourseStatus = "DRAFT" | "PUBLISHED";

const STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

/** Rejection flags the Content mutations may set (anything else is ignored). */
const ERROR_FLAGS = new Set(["assigned", "missing", "locked", "invalid"]);

/** Rejection flags the Lesson Quiz mutations may set (TASK 033). */
const QUIZ_ERROR_FLAGS = new Set([
  "missing",
  "locked",
  "invalid",
  "duplicate",
]);

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
  // Panel-scoped feedback (TASK 033): the quiz mutations redirect
  // with quizError so a quiz rejection never renders the Content
  // panel's (unrelated) message and vice versa.
  const rawQuizError = firstValue((await searchParams).quizError);
  const quizError =
    typeof rawQuizError === "string" && QUIZ_ERROR_FLAGS.has(rawQuizError)
      ? rawQuizError
      : undefined;

  const assigned = await getLessonContents(lesson.id);

  // Lesson Quiz builder data (TASK 033): the lesson's quiz row (null
  // before the first add materializes it) and its assigned Questions
  // in persisted order — loaded for BOTH statuses; PUBLISHED renders
  // the read-only list.
  const quiz = await getLessonQuiz(lesson.id);
  const quizQuestions = quiz
    ? await getQuizQuestions(quiz.id)
    : ([] as Awaited<ReturnType<typeof getQuizQuestions>>);
  const quizQuery = parseLessonQuizSearchParams(await searchParams);

  // The search surfaces only exist for DRAFT courses (Decisions #11).
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

  let quizSearch: Awaited<ReturnType<typeof searchBankQuestions>> | null =
    null;
  let quizSearchFailed = false;
  if (!isPublished) {
    try {
      quizSearch = await searchBankQuestions(quizQuery, quiz?.id ?? null);
    } catch (error) {
      console.error("[admin/lesson-editor] quiz search query failed:", error);
      quizSearchFailed = true;
    }
  }

  // TASK 035: readiness checklist for the Lesson Publish section
  // (CMS §19). Computed only for DRAFT lessons; the quiz lines come
  // from the centralized service. This is UI guidance — the action is
  // the authority (BR §32).
  let publishChecks: PublishCheck[] | null = null;
  if (lesson.status === "DRAFT") {
    const draftContents = assigned.filter(
      (item) => item.status === "DRAFT",
    ).length;
    let quizChecks: PublishCheck[];
    try {
      quizChecks = await getLessonQuizPublishChecks(lesson.id);
    } catch (error) {
      console.error("[admin/lesson-editor] quiz checks query failed:", error);
      quizChecks = [
        {
          id: "lesson-quiz-checks",
          state: "fail",
          label: "Status kuis tidak dapat diperiksa saat ini.",
        },
      ];
    }
    publishChecks = [
      {
        id: "metadata",
        state: lesson.title.trim().length > 0 ? "pass" : "fail",
        label:
          lesson.title.trim().length > 0
            ? "Informasi pelajaran lengkap."
            : "Judul pelajaran wajib diisi.",
      },
      {
        id: "content-count",
        state: assigned.length > 0 ? "pass" : "fail",
        label:
          assigned.length > 0
            ? `${assigned.length} konten ditugaskan.`
            : "Belum ada konten yang ditugaskan.",
      },
      {
        id: "content-published",
        state: draftContents === 0 ? "pass" : "fail",
        label:
          draftContents === 0
            ? "Semua konten sudah diterbitkan."
            : `${draftContents} konten masih berupa draf.`,
      },
      ...quizChecks,
    ];
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

      <LessonQuizPanel
        courseId={course.id}
        lessonId={lesson.id}
        courseStatus={course.status}
        quiz={quiz}
        questions={quizQuestions}
        search={quizSearch}
        searchFailed={quizSearchFailed}
        searchQuery={quizQuery}
        contentQuery={query}
        error={quizError}
        addAction={addQuestionToLessonQuizAction.bind(
          null,
          course.id,
          lesson.id,
        )}
        removeAction={removeQuestionFromLessonQuizAction.bind(
          null,
          course.id,
          lesson.id,
        )}
        reorderAction={reorderQuizQuestionAction.bind(
          null,
          course.id,
          lesson.id,
        )}
      />

      {lesson.status === "DRAFT" && publishChecks ? (
        <PublishForm
          headingId="lesson-publish-heading"
          heading="Terbitkan Pelajaran"
          note="Penerbitan bersifat eksplisit dan divalidasi dari data yang sudah tersimpan. Pelajaran hanya bisa diterbitkan dari kursus yang masih draf."
          action={publishLessonAction.bind(null, course.id, lesson.id)}
          checks={publishChecks}
        />
      ) : null}
    </section>
  );
}
