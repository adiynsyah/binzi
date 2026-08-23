import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge/Badge";
import { CourseForm } from "@/features/courses/components/CourseForm/CourseForm";
import { CourseLessonsPanel } from "@/features/courses/components/CourseLessonsPanel/CourseLessonsPanel";
import { PublishForm } from "@/features/courses/components/PublishForm/PublishForm";
import { getCourseLessons } from "@/features/courses/queries/getCourseLessons";
import { getCourseById } from "@/features/courses/queries/getCourse";
import { publishCourseAction } from "@/features/courses/mutations/publishCourse";
import { updateCourseAction } from "@/features/courses/mutations/updateCourse";
import type { PublishCheck } from "@/features/courses/schemas/publish.schema";
import { FinalQuizPanel } from "@/features/quizzes/components/FinalQuizPanel/FinalQuizPanel";
import { addQuestionToFinalQuizAction } from "@/features/quizzes/mutations/addQuestionToFinalQuiz";
import { removeQuestionFromFinalQuizAction } from "@/features/quizzes/mutations/removeQuestionFromFinalQuiz";
import { reorderFinalQuizQuestionAction } from "@/features/quizzes/mutations/reorderFinalQuizQuestion";
import { getFinalQuiz } from "@/features/quizzes/queries/getFinalQuizForEditor";
import { getQuizQuestions } from "@/features/quizzes/queries/getLessonQuizForEditor";
import { searchBankQuestions } from "@/features/quizzes/queries/searchBankQuestions";
import { parseFinalQuizSearchParams } from "@/features/quizzes/schemas/final-quiz-search.schema";
import {
  getCourseLessonQuizPublishChecks,
  getFinalQuizPublishChecks,
} from "@/features/quizzes/services/quiz.service";

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
 *     Questions with the count-vs-10–30 display-only status),
 *   - Publish (the TASK 035 explicit publish section, CMS §24's
 *     final builder block).
 * There is deliberately no preview link here (no V1 task defines a
 * course preview).
 *
 * TASK 034: the Final Quiz picker's search state lives in the URL
 * under its OWN fq / fqpage params (namespaced so it can never
 * collide with another route's or panel's filter state), and the
 * mutations' actionable rejection feedback rides the panel-scoped
 * ?finalQuizError=… flag. While the course is PUBLISHED the
 * structure is locked in V1 (Decisions Log #11): the search/add and
 * ordering surfaces are not rendered at all and the mutations would
 * reject independently anyway (fail closed at both layers).
 *
 * TASK 035 completes the CMS §24 builder with its final section,
 * Publish: DRAFT courses render the shared PublishForm with a
 * readiness checklist (metadata, lesson count, lesson publish state,
 * per-lesson quiz readiness via the centralized quiz service, and
 * the Final Quiz 10–30 rule). The checklist is guidance (BR §32) —
 * the publishCourse action re-validates everything authoritatively
 * under locks, including the referenced-content rule whose
 * per-lesson state the lesson editors show. PUBLISHED courses show
 * the badge and no publish form.
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

  // TASK 035: readiness checklist for the Course Publish section
  // (CMS §29). Computed only for DRAFT courses; quiz lines come from
  // the centralized service. UI guidance — the publishCourse action
  // is the authority (BR §32) and additionally enforces the
  // referenced-content rule across every lesson.
  let publishChecks: PublishCheck[] | null = null;
  if (!isPublished) {
    const draftLessons = lessons.filter(
      (lesson) => lesson.status === "DRAFT",
    ).length;
    let quizChecks: PublishCheck[];
    try {
      quizChecks = [
        ...(await getCourseLessonQuizPublishChecks(course.id)),
        ...(await getFinalQuizPublishChecks(course.id)),
      ];
    } catch (error) {
      console.error("[admin/course-builder] quiz checks query failed:", error);
      quizChecks = [
        {
          id: "quiz-checks",
          state: "fail",
          label: "Status kuis tidak dapat diperiksa saat ini.",
        },
      ];
    }
    publishChecks = [
      {
        id: "metadata",
        state: course.title.trim().length > 0 ? "pass" : "fail",
        label:
          course.title.trim().length > 0
            ? "Informasi kursus lengkap."
            : "Judul kursus wajib diisi.",
      },
      {
        id: "lesson-count",
        state: lessons.length > 0 ? "pass" : "fail",
        label:
          lessons.length > 0
            ? `${lessons.length} pelajaran tersedia.`
            : "Belum ada pelajaran — minimal satu wajib.",
      },
      {
        id: "lessons-published",
        state: draftLessons === 0 ? "pass" : "fail",
        label:
          draftLessons === 0
            ? "Semua pelajaran sudah diterbitkan."
            : `${draftLessons} pelajaran masih berupa draf — terbitkan pelajaran terlebih dahulu.`,
      },
      ...quizChecks,
    ];
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

      {!isPublished && publishChecks ? (
        <PublishForm
          headingId="course-publish-heading"
          heading="Terbitkan Kursus"
          note="Penerbitan bersifat eksplisit dan divalidasi dari data yang sudah tersimpan. Setelah diterbitkan, struktur kursus terkunci di V1 — semua pelajaran harus diterbitkan terlebih dahulu dan setiap kuis harus siap."
          action={publishCourseAction.bind(null, course.id)}
          checks={publishChecks}
        />
      ) : null}
    </section>
  );
}
