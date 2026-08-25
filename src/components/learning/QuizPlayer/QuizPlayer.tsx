"use client";

import { useState } from "react";

import type { PlayerQuestion } from "@/features/quizzes/queries/getQuizForPlayer";

import styles from "./QuizPlayer.module.scss";

/**
 * BINZI quiz answering UI (TASK 049, Task Plan "Quiz Player" —
 * "Question X of Y / Single answer / Next / Submit"; UI/UX §18–§20;
 * Architecture §8 "Quiz answering UI" Client Component candidate).
 *
 * Sequential answering only (UI/UX §19 — no complex navigation in
 * V1): one question per step, native radios for single-answer
 * selection (§20: only one option selectable, keyboard accessible
 * by construction), and a Next control that stays disabled until an
 * answer is selected ("No answer → Next disabled" — avoids accidental
 * unanswered advancement). The last step shows Submit in place of
 * Next.
 *
 * Selection state lives in this component as questionId → optionId —
 * exactly the pair Architecture §19 names as the legitimate client
 * payload; the SUBMISSION itself (server-side scoring, attempt
 * persistence) is TASK 050/051 ownership, so the Submit control is
 * rendered and enabled per §20 but its server action is bound by the
 * later task. No score or passed state exists here — those are never
 * client-computed (Architecture §19).
 *
 * Props carry only renderable fields plus the ids of the submission
 * contract; correctness (is_correct) is never part of the payload
 * (getQuizForPlayer). Focus visibility and reduced motion come from
 * the global stylesheet.
 */
export function QuizPlayer({ questions }: { questions: PlayerQuestion[] }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (questions.length === 0) {
    return <p className={styles.empty}>Kuis ini belum memiliki soal.</p>;
  }

  const question = questions[current];
  const isLast = current === questions.length - 1;
  const answered = answers[question.id] !== undefined;

  return (
    <div className={styles.player}>
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
          /* TASK 050 binds the server-side submission action here. */
          <button className={styles.submit} disabled={!answered} type="button">
            Kirim Jawaban
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
    </div>
  );
}
