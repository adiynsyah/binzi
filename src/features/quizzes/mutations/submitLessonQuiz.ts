"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessLessonQuiz } from "@/features/quizzes/queries/canAccessLessonQuiz";
import {
  parseQuizSubmissionForm,
  type QuizSubmitState,
} from "@/features/quizzes/schemas/quiz-submission.schema";
import { recordQuizAttempt } from "@/features/quizzes/services/recordQuizAttempt";
import { scoreQuizSubmission } from "@/features/quizzes/services/scoreQuizSubmission";

/**
 * Lesson Quiz submission action (TASK 051, Task Plan "Store Quiz
 * Attempt"; Architecture §18 Quiz Submission — authenticate →
 * validate payload with Zod → verify access → load authoritative
 * data → calculate score → create attempt/answers → return result).
 *
 * Bound to the course and lesson SLUGS on the server (the 028/042
 * binding convention): the page calls
 * submitLessonQuiz.bind(null, slug, lessonSlug), so the client's
 * FormData carries ONLY the QuizPlayer's radio groups — nothing else
 * on the wire is ever read (quiz-submission.schema). This action is
 * deliberately a thin composition of the existing authoritative
 * boundaries and duplicates none of their logic:
 *
 * - auth: createClient + getUser INSIDE the action (enrollCourse
 *   precedent);
 * - access: canAccessLessonQuiz (TASK 048, itself canAccessLesson
 *   044) — the ONE gate; denials are logged with their reason and
 *   answered with behavior-neutral messages (unknown/DRAFT/
 *   not-enrolled/missing-quiz stay indistinguishable, UI/UX §44);
 * - scoring: scoreQuizSubmission (TASK 050) — never recomputed here;
 * - persistence: recordQuizAttempt (TASK 051 service) — one atomic
 *   transaction for attempt + answer snapshot, extended by TASK 052
 *   to complete the lesson in that same transaction when — and only
 *   when — the authoritative result is `passed` (BR §12 step 8). The
 *   enrollment this action forwards is the one canAccessLessonQuiz
 *   already resolved; completion is never client-triggerable.
 *
 * No retry policy: unlimited attempts already hold structurally
 * (BR §13 — every accepted submission is simply a new attempt row).
 *
 * The success state returns ONLY the server-computed verdict
 * (score/passed/counts) — per-answer correctness and internal ids
 * never reach the client. Every rejection logs its reason
 * server-side (the CMS mutation convention).
 */
export async function submitLessonQuiz(
  courseSlug: string,
  lessonSlug: string,
  _prevState: QuizSubmitState,
  formData: FormData,
): Promise<QuizSubmitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("submitLessonQuiz rejected: unauthenticated caller");
    return {
      status: "error",
      message: "Anda harus masuk untuk mengirim jawaban.",
    };
  }

  const access = await canAccessLessonQuiz(user.id, courseSlug, lessonSlug);
  if (!access.allowed) {
    console.error(`submitLessonQuiz rejected: ${access.reason}`);
    if (access.reason === "UNAUTHENTICATED") {
      return {
        status: "error",
        message: "Anda harus masuk untuk mengirim jawaban.",
      };
    }
    if (access.reason === "LESSON_LOCKED") {
      return {
        status: "error",
        message: "Pelajaran ini masih terkunci.",
      };
    }
    // NOT_FOUND / NOT_ENROLLED / QUIZ_NOT_FOUND — indistinguishable.
    return { status: "error", message: "Kuis tidak tersedia." };
  }

  const parsed = parseQuizSubmissionForm(formData);
  if (!parsed.ok) {
    console.error("submitLessonQuiz rejected: invalid submission payload");
    return {
      status: "error",
      message: "Jawaban tidak lengkap atau tidak valid.",
    };
  }

  const result = await scoreQuizSubmission(access.quiz.id, parsed.pairs);
  if (!result.ok) {
    console.error(`submitLessonQuiz rejected: scoring ${result.reason}`);
    if (result.reason === "INVALID_SUBMISSION") {
      return {
        status: "error",
        message: "Jawaban tidak lengkap atau tidak valid.",
      };
    }
    return { status: "error", message: "Kuis tidak tersedia." };
  }

  await recordQuizAttempt(user.id, access.quiz.id, result.score, {
    enrollmentId: access.enrollmentId,
  });

  return {
    status: "success",
    score: result.score.score,
    passed: result.score.passed,
    correctAnswers: result.score.correctAnswers,
    totalQuestions: result.score.totalQuestions,
  };
}
