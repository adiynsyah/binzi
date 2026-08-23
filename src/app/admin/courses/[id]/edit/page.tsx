import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge/Badge";
import { CourseForm } from "@/features/courses/components/CourseForm/CourseForm";
import { CourseLessonsPanel } from "@/features/courses/components/CourseLessonsPanel/CourseLessonsPanel";
import { getCourseLessons } from "@/features/courses/queries/getCourseLessons";
import { getCourseById } from "@/features/courses/queries/getCourse";
import { updateCourseAction } from "@/features/courses/mutations/updateCourse";
import { FinalQuizPanel } from "@/features/quizzes/components/FinalQuizPanel/FinalQuizPanel";
import { addQuestionToFinalQuizAction } from "@/features/quizzes/mutations/addQuestionToFinalQuiz";
import { removeQuestionFromFinalQuizAction } from "@/features/quizzes/mutations/removeQuestionFromFinalQuiz";
import { reorderFinalQuizQuestionAction } from "@/features/quizzes/mutations/reorderFinalQuizQuestion";
import { getFinalQuiz } from "@/features/quizzes/queries/getFinalQuizForEditor";
import { getQuizQuestions } from "@/features/quizzes/queries/getLessonQuizForEditor";
import { searchBankQuestions } from "@/features/quizzes/queries/searchBankQuestions";
import { parseFinalQuizSearchParams } from "@/features/quizzes/schemas/final-quiz-search.schema";

import styles from "./page.module.scss";

/**
 * CMS Course Edit + Course Builder (TASK 023, CMS Spec §6; TASK 024,
 * CMS Spec §7 / Blueprint §23).
 *
 * Server Component: loads the course and its ordered lessons
 * server-side (no data access in the client), renders 404 for unknown
 * or malformed ids, and binds the update action to the course id so
 * the id is never client input. Route-level ADMIN protection is owned
 * by src/proxy.ts (TASK 014 — /admin/:path* covers this route); the
 * mutation additionally authorizes server-side. Both DRAFT and
 * PUBLISHED courses may be edited (Business Rules §24); saving never
 * changes the status.
 *
 * TASK 024 adds the builder experience around the TASK 023 metadata
 * form, mirroring the CMS §7 editor layout:
 *   - header publish state (Badge, per Blueprint §23 "Publish state";
 *     the course publish/unpublish workflow itself is a later task —
 *     BR §3.1 gates it on published, valid lessons and quizzes),
 *   - Course Information (the TASK 023 form),
 *   - Lessons (read-only ordered list; create/reorder/delete are
 *     TASK 025/026/027),
 *   - Final Quiz (the TASK 034 builder — select/reorder/remove
 *     Questions with the count-vs-10–30 display-only status).
 * There is deliberately no publish button and no preview link here.
 *
 * TASK 034: the Final Quiz picker's search state lives in the URL
 * under its OWN fq / fqpage params (namespaced so it can never
 * collide with another route's or panel's filter state), and the
 * mutations' actionable rejection feedback rides the panel-scoped
 * ?finalQuizError=… flag. While the course is PUBLISHED the
 * structure is locked in V1 (Decisions Log #11): the search/add and
 * ordering surfaces are not rendered at all and the mutations would
 * reject independently anyway (fail closed at both layers).
 */
export const metadata: Metadata = {
  title: "Sunting Kursus",
};

type CourseStatus = "DRAFT" | "PUBLISHED";

const STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

/** Rejection flags the Final Quiz mutations may set (TASK 034). */
const FINAL_QUIZ_ERROR_FLAGS = new Set([
  "missing",
  "locked",
  "invalid",
  "duplicate",
]);

function firstValue(value: string | string[] | undefined): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCourseEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;

  const course = await getCourseById(id);
  if (!course) {
    notFound();
  }

  const lessons = await getCourseLessons(course.id);

  const isPublished = course.status === "PUBLISHED";
  const rawQuizError = firstValue((await searchParams).finalQuizError);
  const finalQuizError =
    typeof rawQuizError === "string" && FINAL_QUIZ_ERROR_FLAGS.has(rawQuizError)
      ? rawQuizError
      : undefined;

  // Final Quiz builder data (TASK 034): the course's quiz row (null
  // before the first add materializes it) and its assigned Questions
  // in persisted order — loaded for BOTH statuses; PUBLISHED renders
  // the read-only list.
  const quiz = await getFinalQuiz(course.id);
  const quizQuestions = quiz
    ? await getQuizQuestions(quiz.id)
    : ([] as Awaited<ReturnType<typeof getQuizQuestions>>);
  const quizQuery = parseFinalQuizSearchParams(await searchParams);

  // The search surface only exists for DRAFT courses (Decisions #11).
  let quizSearch: Awaited<ReturnType<typeof searchBankQuestions>> | null =
    null;
  let quizSearchFailed = false;
  if (!isPublished) {
    try {
      quizSearch = await searchBankQuestions(quizQuery, quiz?.id ?? null);
    } catch (error) {
      // Detailed errors belong in server logs (CMS §45).
      console.error("[admin/course-builder] quiz search query failed:", error);
      quizSearchFailed = true;
    }
  }

  return (
    <section aria-labelledby="admin-course-edit-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-course-edit-heading">
            Sunting Kursus
          </h1>
          <div className={styles.introRow}>
            <p className={styles.intro}>{course.title}</p>
            <Badge
              tone={course.status === "PUBLISHED" ? "success" : "warning"}
            >
              {STATUS_LABELS[course.status]}
            </Badge>
          </div>
        </div>
        <Link className={styles.backLink} href="/admin/courses">
          ← Kembali ke Daftar Kursus
        </Link>
      </div>

      <h2 className={styles.infoHeading} id="course-information-heading">
        Informasi Kursus
      </h2>
      <CourseForm
        course={course}
        action={updateCourseAction.bind(null, course.id)}
      />

      <CourseLessonsPanel
        courseId={course.id}
        courseStatus={course.status}
        lessons={lessons}
      />

      <FinalQuizPanel
        courseId={course.id}
        courseStatus={course.status}
        quiz={quiz}
        questions={quizQuestions}
        search={quizSearch}
        searchFailed={quizSearchFailed}
        searchQuery={quizQuery}
        error={finalQuizError}
        addAction={addQuestionToFinalQuizAction.bind(null, course.id)}
        removeAction={removeQuestionFromFinalQuizAction.bind(null, course.id)}
        reorderAction={reorderFinalQuizQuestionAction.bind(null, course.id)}
      />
    </section>
  );
}
