import { z } from "zod";

/**
 * Question Create/Edit validation (TASK 031, Blueprint §26, BR §14/
 * §15, CMS §22).
 *
 * Field set is exactly the Task Plan requirement list — Question
 * text, Options, correct-option selection, optional Explanation.
 * Nothing else is part of the contract: sort_order, ids beyond the
 * server-rendered option row keys, timestamps, and any quiz
 * linkage are server-owned and never read from the payload.
 *
 * Option counts follow source authority:
 * - MINIMUM 2 — Blueprint §26 "at least 2 options".
 * - MAXIMUM 10 — Blueprint §26 explicitly delegates the exact
 *   number to implementation ("treated as an implementation detail
 *   unless explicitly changed later"); 10 keeps single-answer
 *   radio groups legible and bounds the transaction size. It is an
 *   implementation guardrail, not a business rule from the specs.
 *
 * "Exactly one correct option" is validated from the FINAL row set
 * the server is about to persist (BR §14/§15): the form renders a
 * radio group (single value), but a forged multipart POST can carry
 * anything, so the mutation counts correct rows itself and rejects
 * zero/multiple. Row-level CHECK cannot express this (Drizzle Spec
 * §11) — it is deliberately service-layer validation here, and
 * quiz publish validation (TASK 035) re-checks it independently.
 *
 * Length bounds are sanity guardrails (TEXT columns are unbounded):
 * they prevent accidental megabyte-sized submissions, not business
 * rules — no source specifies question/option lengths.
 */

/** Minimum options per Blueprint §26. */
export const QUESTION_MIN_OPTIONS = 2;
/** Maximum options — implementation detail delegated by Blueprint §26. */
export const QUESTION_MAX_OPTIONS = 10;

export const questionFormSchema = z.object({
  questionText: z
    .string()
    .trim()
    .min(1, "Teks soal wajib diisi.")
    .max(2000, "Teks soal maksimal 2000 karakter."),
  explanation: z
    .string()
    .trim()
    .max(2000, "Pembahasan maksimal 2000 karakter.")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  options: z
    .array(
      z.object({
        /** Server-rendered row key on edit; undefined for new rows. */
        optionId: z.string().uuid().optional(),
        optionText: z
          .string()
          .trim()
          .min(1, "Teks opsi wajib diisi.")
          .max(200, "Teks opsi maksimal 200 karakter."),
      }),
    )
    .min(QUESTION_MIN_OPTIONS, `Minimal ${QUESTION_MIN_OPTIONS} opsi.`)
    .max(QUESTION_MAX_OPTIONS, `Maksimal ${QUESTION_MAX_OPTIONS} opsi.`),
  /** Index into `options` marking the single correct row. */
  correctIndex: z.number().int().min(0),
});

export type QuestionFormInput = z.infer<typeof questionFormSchema>;

export type QuestionFormField =
  | "questionText"
  | "explanation"
  | "options"
  | "correctIndex";

export type QuestionFormFieldErrors = Partial<
  Record<QuestionFormField, string>
>;

/**
 * State returned by the create/edit server actions and consumed by
 * the form via `useActionState`. Successful saves never return a
 * state — the action redirects to the Question Bank (TASK 018/019
 * convention).
 */
export type QuestionFormState =
  | { status: "idle" }
  | {
      status: "error";
      /** Per-field validation messages. */
      errors?: QuestionFormFieldErrors;
      /** Form-level message (auth, permission, missing, storage). */
      message?: string;
    };

export const initialQuestionFormState: QuestionFormState = {
  status: "idle",
};

/** Option row shape handed to the form (create: synthetic keys). */
export type QuestionFormOption = {
  /** Existing question_options.id on edit; undefined for new rows. */
  optionId?: string;
  optionText: string;
  isCorrect: boolean;
};

/** Editable question shape handed to the form (editor query). */
export type EditableQuestion = {
  id: string;
  questionText: string;
  explanation: string | null;
  options: QuestionFormOption[];
  /** quiz_questions rows referencing this question (CMS §24 note). */
  usedInCount: number;
};
