"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Button } from "@/components/ui/Button/Button";

import {
  QUESTION_MAX_OPTIONS,
  QUESTION_MIN_OPTIONS,
  initialQuestionFormState,
  type QuestionFormOption,
  type QuestionFormState,
} from "../../schemas/question-form.schema";
import styles from "./QuestionForm.module.scss";

/**
 * BINZI Question Create/Edit form (TASK 031, CMS §22, BR §14/§15).
 *
 * Fields exactly per the approved Question Editor set: Question
 * text, Options with ONE correct radio (single-answer multiple
 * choice), optional Explanation. The radio interaction enforces
 * "only one option can be marked correct" client-side (CMS §22);
 * the server action re-validates the FINAL set — this UI is only
 * a first gate.
 *
 * Option rows are native indexed fields (`optionText_${i}` plus
 * the server-rendered `optionId_${i}` keys on edit) and ONE radio
 * group (`correctOption`), so the form still submits without
 * JavaScript. Add/remove rows need JS but degrade gracefully: the
 * rendered rows (4 on create, the persisted set on edit) remain
 * fully submittable. The submitted row ORDER is the intended
 * option order; the server alone assigns sort_order 1..N.
 *
 * No nested forms; the remove buttons are type="button". Errors
 * come from the server action state (useActionState), never from
 * the client as authority.
 */

/** A–J letters for the single-answer radio group. */
const OPTION_LETTERS = "ABCDEFGHIJ".split("");

type Action = (
  prev: QuestionFormState,
  formData: FormData,
) => Promise<QuestionFormState>;

export function QuestionForm({
  action,
  initialQuestionText = "",
  initialExplanation = "",
  initialOptions,
  submitLabel,
}: {
  /** createQuestionAction, or updateQuestionAction bound to the id. */
  action: Action;
  initialQuestionText?: string;
  initialExplanation?: string;
  /** Persisted options on edit; 4 empty rows on create (CMS §22 mock). */
  initialOptions: QuestionFormOption[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialQuestionFormState,
  );
  const [questionText, setQuestionText] = useState(initialQuestionText);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [rows, setRows] = useState(initialOptions);
  const [correct, setCorrect] = useState<string | null>(
    initialOptions.findIndex((option) => option.isCorrect) >= 0
      ? String(initialOptions.findIndex((option) => option.isCorrect))
      : null,
  );

  const errors = state.status === "error" ? state.errors : undefined;

  function addRow() {
    if (rows.length >= QUESTION_MAX_OPTIONS) return;
    setRows([...rows, { optionText: "", isCorrect: false }]);
  }

  function removeRow(index: number) {
    if (rows.length <= QUESTION_MIN_OPTIONS) return;
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    // Keep the radio pointing at the same logical row after the
    // shift; a removed selection must be re-chosen.
    if (correct !== null) {
      const selected = Number(correct);
      if (selected === index) {
        setCorrect(null);
      } else if (selected > index) {
        setCorrect(String(selected - 1));
      }
    }
  }

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="question-text">
            Teks Soal
          </label>
          <textarea
            id="question-text"
            name="questionText"
            className={errors?.questionText ? styles.textareaInvalid : styles.textarea}
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            rows={3}
            maxLength={2000}
            required
            disabled={isPending}
            aria-invalid={errors?.questionText ? true : undefined}
          />
          {errors?.questionText ? (
            <p className={styles.fieldError}>{errors.questionText}</p>
          ) : null}
        </div>

        <fieldset className={styles.optionsFieldset}>
          <legend className={styles.fieldLabel}>Opsi Jawaban</legend>
          <p className={styles.hint}>
            Pilih satu jawaban benar. Minimal {QUESTION_MIN_OPTIONS} opsi,
            maksimal {QUESTION_MAX_OPTIONS} opsi.
          </p>

          <div className={styles.optionRows}>
            {rows.map((row, index) => {
              const letter = OPTION_LETTERS[index];
              return (
                <div key={row.optionId ?? `new-${index}`} className={styles.optionRow}>
                  <input
                    type="radio"
                    name="correctOption"
                    value={index}
                    checked={correct === String(index)}
                    onChange={() => setCorrect(String(index))}
                    className={styles.optionRadio}
                    aria-label={`Jadikan opsi ${letter} jawaban benar`}
                    disabled={isPending}
                  />
                  <input
                    type="text"
                    name={`optionText_${index}`}
                    className={errors?.options ? styles.optionInputInvalid : styles.optionInput}
                    value={row.optionText}
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...row, optionText: event.target.value };
                      setRows(next);
                    }}
                    placeholder={`Opsi ${letter}`}
                    maxLength={200}
                    aria-label={`Teks opsi ${letter}`}
                    disabled={isPending}
                  />
                  {row.optionId !== undefined ? (
                    <input type="hidden" name={`optionId_${index}`} value={row.optionId} />
                  ) : null}
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeRow(index)}
                    disabled={isPending || rows.length <= QUESTION_MIN_OPTIONS}
                    aria-label={`Hapus opsi ${letter}`}
                  >
                    Hapus
                  </button>
                </div>
              );
            })}
          </div>

          {errors?.options ? (
            <p className={styles.fieldError}>{errors.options}</p>
          ) : null}
          {errors?.correctIndex ? (
            <p className={styles.fieldError}>{errors.correctIndex}</p>
          ) : null}

          <button
            type="button"
            className={styles.addButton}
            onClick={addRow}
            disabled={isPending || rows.length >= QUESTION_MAX_OPTIONS}
          >
            + Tambah Opsi
          </button>
        </fieldset>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="question-explanation">
            Pembahasan <span className={styles.optional}>(opsional)</span>
          </label>
          <textarea
            id="question-explanation"
            name="explanation"
            className={errors?.explanation ? styles.textareaInvalid : styles.textarea}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            rows={3}
            maxLength={2000}
            disabled={isPending}
            aria-invalid={errors?.explanation ? true : undefined}
          />
          {errors?.explanation ? (
            <p className={styles.fieldError}>{errors.explanation}</p>
          ) : null}
        </div>
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan…" : submitLabel}
        </Button>
        <Link
          href="/admin/questions"
          className={`${buttonStyles.button} ${buttonStyles.secondary}`}
        >
          Batal
        </Link>
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className={styles.messageError}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
