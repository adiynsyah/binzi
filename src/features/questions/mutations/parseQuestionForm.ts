import {
  questionFormSchema,
  type QuestionFormFieldErrors,
  type QuestionFormInput,
} from "../schemas/question-form.schema";

/**
 * Shared FormData → QuestionFormInput parser (TASK 031).
 *
 * The form encodes its option rows as indexed native fields
 * (`optionText_${i}`, optional `optionId_${i}` hidden keys rendered
 * by the server on edit) plus ONE radio value (`correctOption`
 * holding the chosen row index). This stays submittable without
 * JavaScript — plain named inputs, no serialized JSON payload.
 *
 * Tamper-hardening applied while collecting, before zod runs:
 * - duplicate row indexes (forged repeated `optionText_5`) are
 *   rejected instead of silently overwriting;
 * - `correctOption` must arrive exactly ONCE (getAll) — a radio
 *   group can only produce one value; more is a forged payload;
 * - the chosen index must point at a submitted row.
 *
 * The row order in the payload IS the intended option order; the
 * mutations turn it into the authoritative sort_order 1..N. The
 * client can never submit a sort_order value — the field does not
 * exist.
 */

export type ParseResult =
  | { ok: true; data: QuestionFormInput }
  | { ok: false; errors: QuestionFormFieldErrors };

const OPTION_TEXT_RE = /^optionText_(\d+)$/;
const OPTION_ID_RE = /^optionId_(\d+)$/;
const CORRECT_FIELD = "correctOption";
const CORRECT_ERROR = "Pilih satu opsi sebagai jawaban benar.";

function formValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

export function parseQuestionForm(formData: FormData): ParseResult {
  const texts = new Map<number, string>();
  const ids = new Map<number, string>();

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const textMatch = key.match(OPTION_TEXT_RE);
    if (textMatch) {
      const index = Number(textMatch[1]);
      if (texts.has(index)) {
        return { ok: false, errors: { options: "Form opsi tidak valid." } };
      }
      texts.set(index, value);
      continue;
    }
    const idMatch = key.match(OPTION_ID_RE);
    if (idMatch) {
      const index = Number(idMatch[1]);
      if (ids.has(index)) {
        return { ok: false, errors: { options: "Form opsi tidak valid." } };
      }
      ids.set(index, value);
    }
  }

  // Row order = ascending submitted index (0,1,2,…).
  const indexes = [...texts.keys()].sort((a, b) => a - b);
  const options = indexes.map((index) => {
    const optionId = ids.get(index);
    return {
      ...(optionId !== undefined ? { optionId } : {}),
      optionText: texts.get(index) ?? "",
    };
  });

  // Exactly one radio value; forged payloads carrying several die here.
  const correctValues = formData.getAll(CORRECT_FIELD).filter((v) => typeof v === "string");
  if (correctValues.length !== 1) {
    return { ok: false, errors: { correctIndex: CORRECT_ERROR } };
  }
  const correctIndex = Number(correctValues[0]);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    return { ok: false, errors: { correctIndex: CORRECT_ERROR } };
  }

  const parsed = questionFormSchema.safeParse({
    questionText: formValue(formData, "questionText") ?? "",
    explanation: formValue(formData, "explanation") ?? "",
    options,
    correctIndex,
  });

  if (!parsed.success) {
    const errors: QuestionFormFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof QuestionFormFieldErrors | undefined;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { ok: false, errors };
  }

  return { ok: true, data: parsed.data };
}
