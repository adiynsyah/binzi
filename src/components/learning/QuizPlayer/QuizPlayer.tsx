"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { PlayerQuestion } from "@/features/quizzes/queries/getQuizForPlayer";
import {
  initialQuizSubmitState,
  type QuizSubmitState,
} from "@/features/quizzes/schemas/quiz-submission.schema";

import styles from "./QuizPlayer.module.scss";

/**
 * BINZI quiz answering UI (TASK 049, Task Plan "Quiz Player" —
 * "Question X of Y / Single answer / Next / Submit"; UI/UX §18–§20;
 * Architecture §8 "Quiz answering UI" Client Component candidate;
 * submission wiring added by TASK 051).
 *
 * Sequential answering only (UI/UX §19 — no complex navigation in
 * V1): one question per step, native radios for single-answer
 * selection (§20: only one option selectable, keyboard accessible
 * by construction), and a Next control that stays disabled until an
 * answer is selected ("No answer → Next disabled" — avoids accidental
 * unanswered advancement). The last step shows Submit in place of
 * Next.
 *
 * TASK 051 wires Submit to the page-bound server action
 * (submitLessonQuiz bound to the course/lesson slugs server-side —
 * the client submits only the radio groups). The radios double as
 * the form's wire payload: each `question-{id}` group contributes
 * exactly one (questionId, selectedOptionId) pair, the ONLY client
 * payload Architecture §19 allows. The action's state carries just
 * the server-computed verdict; no score/passed is ever computed
 * here, and per-answer correctness never reaches this component.
 *
 * TASK 052 renders the result screen per UI/UX §21/§22 (+ §17's
 * completion note): pass/fail, score, correct count, and the next
 * action. This component never decides completion — it only renders
 * the server verdict. TASK 053 adds the §23 retry experience on the
 * failed branch — the "review the lesson" guidance line plus BOTH
 * §23 actions ([Review Lesson] → the lesson page, [Try Quiz Again]
 * → a plain reload of this page). Unlimited attempts hold
 * structurally (BR §11/§13): no limit, cooldown, or attempt count
 * exists to display or enforce in V1. The next-lesson link targets
 * are computed server-side by the page over the published lesson set.
 *
 * TASK 055 reuses this player for the Final Quiz (no second player):
 * the optional passedNote/retryHint props swap the two lesson-specific
 * sentences for Final-Quiz-truthful copy — a passed Final Quiz
 * completes NO lesson (BR §17; course completion is TASK 057), and
 * its review target is the whole course, not one lesson. Omitting
 * the props keeps the lesson behavior byte-identical.
 *
 * Focus visibility and reduced motion come from the global stylesheet.
 */
export function QuizPlayer({
  questions,
  action,
  quizHref,
  lessonHref,
  nextLessonHref,
  learnHubHref,
  passedNote = "Anda lulus kuis ini. Pelajaran ini selesai.",
  retryHint = "Pelajari kembali pelajaran ini, lalu coba lagi.",
}: {
  questions: PlayerQuestion[];
  /** submitLessonQuiz bound to (courseSlug, lessonSlug) by the page. */
  action: (
    state: QuizSubmitState,
    formData: FormData,
  ) => Promise<QuizSubmitState>;
  /** This quiz page — the §21/§23 "Try Again" reload target. */
  quizHref: string;
  /** The lesson page — the §23 "Review Lesson" target. */
  lessonHref: string;
  /** Next published lesson after this one, or null when this is the last. */
  nextLessonHref: string | null;
  /** The learning hub — fallback CTA when the passed lesson is the last. */
  learnHubHref: string;
  /** §17 pass note; the Final Quiz passes its own (completes no lesson). */
  passedNote?: string;
  /** §23 guidance line; the Final Quiz points at the whole course. */
  retryHint?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, formAction, isPending] = useActionState(
    action,
    initialQuizSubmitState,
  );

  if (questions.length === 0) {
    return <p className={styles.empty}>Kuis ini belum memiliki soal.</p>;
  }

  if (state.status === "success") {
    return (
      <div className={styles.result} role="status">
        <p className={styles.resultHeading}>
          {state.passed ? "🎉 Hebat!" : "Terus belajar"}
        </p>
        <p className={styles.resultScore}>
          Skor Anda: {state.score}% ({state.correctAnswers}/
          {state.totalQuestions} soal benar)
        </p>
        {state.passed ? (
          <>
            <p className={styles.resultPassed}>{passedNote}</p>
            <div className={styles.resultActions}>
              {nextLessonHref ? (
                <Link className={styles.resultCta} href={nextLessonHref}>
                  Lanjut ke Pelajaran Berikutnya
                </Link>
              ) : (
                <Link className={styles.resultCta} href={learnHubHref}>
                  Kembali ke Daftar Pelajaran
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <p className={styles.resultFailed}>
              Anda memerlukan 80% untuk lulus.
            </p>
            <p className={styles.resultHint}>{retryHint}</p>
            <div className={styles.resultActions}>
              {/* §23 retry pair — review the lesson first, then try
                  again. The review link goes to the lesson page; the
                  retry is a plain anchor on purpose (a full reload
                  resets the player for a fresh attempt — unlimited
                  attempts, BR §11/§13, nothing to enforce). */}
              <Link
                className={`${styles.resultCta} ${styles.resultCtaSecondary}`}
                href={lessonHref}
              >
                Baca Pelajaran
              </Link>
              <a className={styles.resultCta} href={quizHref}>
                Coba Lagi
              </a>
            </div>
          </>
        )}
      </div>
    );
  }

  const question = questions[current];
  const isLast = current === questions.length - 1;
  const answered = answers[question.id] !== undefined;

  return (
    <form action={formAction} className={styles.player}>
      <p className={styles.position}>
        Soal {current + 1} dari {questions.length}
      </p>
      <fieldset className={styles.question}>
        <legend className={styles.questionText}>{question.text}</legend>
        <div className={styles.options} role="radiogroup" aria-label="Pilihan jawaban">
          {question.options.map((option) => (
            <label className={styles.option} key={option.id}>
              <input
                checked={answers[question.id] === option.id}
                name={`question-${question.id}`}
                onChange={() =>
                  setAnswers((prev) => ({ ...prev, [question.id]: option.id }))
                }
                type="radio"
                value={option.id}
              />
              <span className={styles.optionText}>{option.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.controls}>
        {isLast ? (
          <button
            className={styles.submit}
            disabled={!answered || isPending}
            type="submit"
          >
            {isPending ? "Mengirim…" : "Kirim Jawaban"}
          </button>
        ) : (
          <button
            className={styles.next}
            disabled={!answered}
            onClick={() => setCurrent((index) => index + 1)}
            type="button"
          >
            Berikutnya
          </button>
        )}
      </div>
      {state.status === "error" ? (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
