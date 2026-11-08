// Question input contract (card S1-09 §1) — the ONE home of the PRD QZ-04
// (Q40) question rules. Client-safe on purpose (pure Zod, no server
// imports): the 22b dialog, the two API routes, and the CSV import (card
// Sen 9) all parse this identical contract, so a rejected import row and a
// rejected form field say the same sentence. Letters A–D are DERIVED from
// option order (never stored) — here only to name the offending option in
// a message.
import { z } from "zod";

export const QUESTION_LIMITS = {
  textMax: 2_000,
  explanationMax: 5_000,
  optionMax: 500,
} as const;

/** Fixed TRUE_FALSE option texts, in order (QZ-04; the dialog renders them static). */
export const TRUE_FALSE_OPTIONS = ["Benar", "Salah"] as const;

export type QuestionType = "SINGLE_CHOICE" | "TRUE_FALSE";

/** The letter an option-row error names: A–D by index; a 5th+ row only
 *  ever appears together with the "tepat 4 opsi" count error. */
function optionLabel(index: number): string {
  return index < 4 ? String.fromCharCode(65 + index) : String(index + 1);
}

// Messages mirror QUESTION_LIMITS with id-ID thousand separators ("2.000",
// "5.000") — literals, not toLocaleString, so tests assert exact copy.
const baseShape = {
  text: z
    .string()
    .trim()
    .min(1, "Pertanyaan wajib diisi.")
    .max(QUESTION_LIMITS.textMax, "Pertanyaan maksimal 2.000 karakter."),
  explanation: z
    .string()
    .trim()
    .min(1, "Pembahasan wajib diisi.")
    .max(QUESTION_LIMITS.explanationMax, "Pembahasan maksimal 5.000 karakter."),
};

const optionInput = z.strictObject({
  text: z.string(),
  isCorrect: z.boolean(),
});

/**
 * SINGLE_CHOICE option rules, all collected (never first-only): per-option
 * emptiness/length/duplicates at `options.{i}.text`; the count and the
 * exactly-one-key rules at `options`. Duplicate comparison happens AFTER
 * trimming and case-folding; the error lands on the SECOND occurrence.
 */
function refineChoiceOptions(
  options: { text: string; isCorrect: boolean }[],
  ctx: z.RefinementCtx,
): void {
  if (options.length !== 4) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Pilihan ganda harus punya tepat 4 opsi.",
    });
  }
  const seen = new Map<string, number>();
  options.forEach((option, index) => {
    const trimmed = option.text.trim();
    const label = optionLabel(index);
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options", index, "text"],
        message: `Opsi ${label} wajib diisi.`,
      });
      return;
    }
    if (trimmed.length > QUESTION_LIMITS.optionMax) {
      ctx.addIssue({
        code: "custom",
        path: ["options", index, "text"],
        message: `Opsi ${label} maksimal 500 karakter.`,
      });
    }
    const fold = trimmed.toLowerCase();
    const firstSeen = seen.get(fold);
    if (firstSeen !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["options", index, "text"],
        message: `Opsi ${label} sama dengan opsi lain.`,
      });
    } else {
      seen.set(fold, index);
    }
  });
}

function exactlyOneKeyIssue(
  options: { isCorrect: boolean }[],
  ctx: z.RefinementCtx,
): void {
  if (options.filter((option) => option.isCorrect).length !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Tandai tepat satu kunci jawaban.",
    });
  }
}

/**
 * The question input (card S1-09 §1): `{ type, text, explanation,
 * options: { text, isCorrect }[] }`, strict at every level. TRUE_FALSE
 * options must be exactly "Benar", "Salah" in order — the client renders
 * them fixed and sends them along (one rule, one message, so a CSV row and
 * a form toggle fail identically). Parse output is fully trimmed.
 */
export const questionInput = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("SINGLE_CHOICE"),
      ...baseShape,
      options: z.array(optionInput),
    }),
    z.strictObject({
      type: z.literal("TRUE_FALSE"),
      ...baseShape,
      options: z.array(optionInput),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.type === "SINGLE_CHOICE") {
      refineChoiceOptions(value.options, ctx);
      exactlyOneKeyIssue(value.options, ctx);
      return;
    }
    const shapeOk =
      value.options.length === TRUE_FALSE_OPTIONS.length &&
      value.options[0]?.text === TRUE_FALSE_OPTIONS[0] &&
      value.options[1]?.text === TRUE_FALSE_OPTIONS[1];
    if (!shapeOk) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Soal benar/salah harus berisi opsi Benar dan Salah.",
      });
    }
    exactlyOneKeyIssue(value.options, ctx);
  })
  .transform((value) => ({
    ...value,
    options: value.options.map((option) => ({
      ...option,
      text: option.text.trim(),
    })),
  }));

export type QuestionInput = z.infer<typeof questionInput>;

/** Quiz-page lookups (guard order: role first, then this parse). */
export const getQuizInput = z.strictObject({ quizId: z.uuid() });

export type GetQuizInput = z.infer<typeof getQuizInput>;
