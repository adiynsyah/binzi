"use client";

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
 * Focus visibility and reduced motion come from the global stylesheet.
 */
export function QuizPlayer({
  questions,
  action,
}: {
  questions: PlayerQuestion[];
  /** submitLessonQuiz bound to (courseSlug, lessonSlug) by the page. */
  action: (
    state: QuizSubmitState,
    formData: FormData,
  ) => Promise<QuizSubmitState>;
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
        <p className={styles.resultScore}>
          Skor Anda: {state.score}% ({state.correctAnswers}/
          {state.totalQuestions} soal benar)
        </p>
        <p className={state.passed ? styles.resultPassed : styles.resultFailed}>
          {state.passed
            ? "Selamat! Anda lulus kuis ini."
            : "Anda belum lulus kuis ini. Muat ulang halaman untuk mencoba lagi."}
        </p>
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
