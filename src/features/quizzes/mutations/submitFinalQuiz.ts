"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessFinalQuiz } from "@/features/quizzes/queries/canAccessFinalQuiz";
import {
  parseQuizSubmissionForm,
  type QuizSubmitState,
} from "@/features/quizzes/schemas/quiz-submission.schema";
import { recordQuizAttempt } from "@/features/quizzes/services/recordQuizAttempt";
import { scoreQuizSubmission } from "@/features/quizzes/services/scoreQuizSubmission";

/**
 * Final Quiz submission action (TASK 055, Task Plan "Final Quiz Access";
 * Architecture §18 submission pipeline; Blueprint §30/§31). The exact
 * mirror of submitLessonQuiz (TASK 051) with the two Final-Quiz
 * differences the specs demand:
 *
 * - access: canAccessFinalQuiz (TASK 048) — the ONE Final Quiz gate,
 *   which derives all-lessons-completed from getCourseProgress over
 *   the LATEST PUBLISHED set (BR §17/§38) and checks it BEFORE quiz
 *   resolution, so an unfinished learner cannot probe whether the
 *   quiz exists. Bound to the course slug on the server
 *   (.bind(null, slug) — the 028/042 convention): the client's
 *   FormData carries ONLY the QuizPlayer radio groups, and the quiz
 *   id used for scoring/persistence is the one the gate resolved —
 *   never a client-supplied quiz id.
 *
 * - persistence: recordQuizAttempt with the enrollment resolved by
 *   the gate. A passed Final Quiz completes NO lesson (the quiz's
 *   lesson_id is null, so the 052 branch cannot fire) — inside the
 *   same transaction it completes the ENROLLMENT instead (TASK 057,
 *   Task Plan "Complete enrollment"; BR §18; Blueprint §32): a
 *   guarded ACTIVE → COMPLETED advance that is idempotent on repeat
 *   passes and cannot be downgraded by later failures. The action's
 *   success state carries the server-determined courseCompleted flag
 *   (BR §30) so the result surface can render the §26 completion
 *   screen; a failed submission completes nothing. Unlimited
 *   attempts (BR §13/§16) hold structurally: every accepted
 *   submission is a new attempt.
 *
 * Scoring is scoreQuizSubmission (TASK 050) — the same scorer, never
 * a second implementation; verdict fields on the wire are never read
 * (quiz-submission.schema). Denials are logged with their reason and
 * answered with behavior-neutral messages — unknown course, DRAFT
 * course, not-enrolled, and missing quiz stay indistinguishable
 * (UI/UX §44); FINAL_QUIZ_LOCKED names the requirement so the
 * message matches the §24 explain-why discipline. The success state
 * returns ONLY the server-computed verdict — per-answer correctness
 * and internal ids never reach the client.
 */
export async function submitFinalQuiz(
  courseSlug: string,
  _prevState: QuizSubmitState,
  formData: FormData,
): Promise<QuizSubmitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("submitFinalQuiz rejected: unauthenticated caller");
    return {
      status: "error",
      message: "Anda harus masuk untuk mengirim jawaban.",
    };
  }

  const access = await canAccessFinalQuiz(user.id, courseSlug);
  if (!access.allowed) {
    console.error(`submitFinalQuiz rejected: ${access.reason}`);
    if (access.reason === "UNAUTHENTICATED") {
      return {
        status: "error",
        message: "Anda harus masuk untuk mengirim jawaban.",
      };
    }
    if (access.reason === "FINAL_QUIZ_LOCKED") {
      return {
        status: "error",
        message: "Selesaikan semua pelajaran untuk membuka Kuis Akhir.",
      };
    }
    // NOT_FOUND / NOT_ENROLLED / QUIZ_NOT_FOUND — indistinguishable.
    return { status: "error", message: "Kuis tidak tersedia." };
  }

  const parsed = parseQuizSubmissionForm(formData);
  if (!parsed.ok) {
    console.error("submitFinalQuiz rejected: invalid submission payload");
    return {
      status: "error",
      message: "Jawaban tidak lengkap atau tidak valid.",
    };
  }

  const result = await scoreQuizSubmission(access.quiz.id, parsed.pairs);
  if (!result.ok) {
    console.error(`submitFinalQuiz rejected: scoring ${result.reason}`);
    if (result.reason === "INVALID_SUBMISSION") {
      return {
        status: "error",
        message: "Jawaban tidak lengkap atau tidak valid.",
      };
    }
    return { status: "error", message: "Kuis tidak tersedia." };
  }

  // TASK 057: the enrollment resolved by the gate enters the ONE
  // transaction — a pass completes the enrollment there (never a
  // lesson; the FINAL quiz's lesson_id is null), a fail completes
  // nothing. courseCompleted is the transaction's server-determined
  // verdict (BR §30), never a client field.
  const attempt = await recordQuizAttempt(user.id, access.quiz.id, result.score, {
    enrollmentId: access.enrollmentId,
  });

  return {
    status: "success",
    score: result.score.score,
    passed: result.score.passed,
    correctAnswers: result.score.correctAnswers,
    totalQuestions: result.score.totalQuestions,
    courseCompleted: attempt.courseCompleted,
  };
}
