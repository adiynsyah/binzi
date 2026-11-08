// The question input contract (card S1-09 §1): every rule of both
// discriminated branches as a pass/fail table, the exact issue paths
// (the dialog maps them onto fields), strictObject rejection of extra
// keys, and the trimmed parse output.
import { describe, expect, it } from "vitest";

import { TRUE_FALSE_OPTIONS, questionInput } from "./schema";

/** A minimal valid PG input — spread and bent per row. */
const PG = {
  type: "SINGLE_CHOICE",
  text: "Soal pertanyaan",
  explanation: "Pembahasan jawaban",
  options: [
    { text: "Opsi satu", isCorrect: true },
    { text: "Opsi dua", isCorrect: false },
    { text: "Opsi tiga", isCorrect: false },
    { text: "Opsi empat", isCorrect: false },
  ],
} as const;

/** A minimal valid B/S input. */
const BS = {
  type: "TRUE_FALSE",
  text: "Soal pertanyaan",
  explanation: "Pembahasan jawaban",
  options: [
    { text: TRUE_FALSE_OPTIONS[0], isCorrect: true },
    { text: TRUE_FALSE_OPTIONS[1], isCorrect: false },
  ],
} as const;

type Row = {
  name: string;
  input: unknown;
  issue: { path: string; message: string };
};

const PG_FAIL: Row[] = [
  {
    name: "empty question",
    input: { ...PG, text: "  " },
    issue: { path: "text", message: "Pertanyaan wajib diisi." },
  },
  {
    name: "question over 2.000",
    input: { ...PG, text: "a".repeat(2_001) },
    issue: { path: "text", message: "Pertanyaan maksimal 2.000 karakter." },
  },
  {
    name: "empty explanation",
    input: { ...PG, explanation: "" },
    issue: { path: "explanation", message: "Pembahasan wajib diisi." },
  },
  {
    name: "explanation over 5.000",
    input: { ...PG, explanation: "a".repeat(5_001) },
    issue: {
      path: "explanation",
      message: "Pembahasan maksimal 5.000 karakter.",
    },
  },
  {
    name: "3 options",
    input: { ...PG, options: PG.options.slice(0, 3) },
    issue: {
      path: "options",
      message: "Pilihan ganda harus punya tepat 4 opsi.",
    },
  },
  {
    name: "5 options",
    input: {
      ...PG,
      options: [...PG.options, { text: "Opsi lima", isCorrect: false }],
    },
    issue: {
      path: "options",
      message: "Pilihan ganda harus punya tepat 4 opsi.",
    },
  },
  {
    name: "empty option B",
    input: {
      ...PG,
      options: PG.options.map((option, index) =>
        index === 1 ? { ...option, text: " " } : option,
      ),
    },
    issue: { path: "options.1.text", message: "Opsi B wajib diisi." },
  },
  {
    name: "option over 500",
    input: {
      ...PG,
      options: PG.options.map((option, index) =>
        index === 2 ? { ...option, text: "a".repeat(501) } : option,
      ),
    },
    issue: { path: "options.2.text", message: "Opsi C maksimal 500 karakter." },
  },
  {
    name: "duplicate option (case-folded, error on the SECOND occurrence)",
    input: {
      ...PG,
      options: PG.options.map((option, index) =>
        index === 3 ? { ...option, text: "opsi SATU" } : option,
      ),
    },
    issue: { path: "options.3.text", message: "Opsi D sama dengan opsi lain." },
  },
  {
    name: "no key",
    input: {
      ...PG,
      options: PG.options.map((option) => ({ ...option, isCorrect: false })),
    },
    issue: { path: "options", message: "Tandai tepat satu kunci jawaban." },
  },
  {
    name: "two keys",
    input: {
      ...PG,
      options: PG.options.map((option, index) => ({
        ...option,
        isCorrect: index < 2,
      })),
    },
    issue: { path: "options", message: "Tandai tepat satu kunci jawaban." },
  },
];

const BS_FAIL: Row[] = [
  {
    name: "Ya/Tidak texts",
    input: {
      ...BS,
      options: [
        { text: "Ya", isCorrect: true },
        { text: "Tidak", isCorrect: false },
      ],
    },
    issue: {
      path: "options",
      message: "Soal benar/salah harus berisi opsi Benar dan Salah.",
    },
  },
  {
    name: "swapped order",
    input: {
      ...BS,
      options: [
        { text: TRUE_FALSE_OPTIONS[1], isCorrect: true },
        { text: TRUE_FALSE_OPTIONS[0], isCorrect: false },
      ],
    },
    issue: {
      path: "options",
      message: "Soal benar/salah harus berisi opsi Benar dan Salah.",
    },
  },
  {
    name: "single option",
    input: { ...BS, options: BS.options.slice(0, 1) },
    issue: {
      path: "options",
      message: "Soal benar/salah harus berisi opsi Benar dan Salah.",
    },
  },
  {
    name: "no key",
    input: {
      ...BS,
      options: BS.options.map((option) => ({ ...option, isCorrect: false })),
    },
    issue: { path: "options", message: "Tandai tepat satu kunci jawaban." },
  },
  {
    name: "two keys",
    input: {
      ...BS,
      options: BS.options.map((option) => ({ ...option, isCorrect: true })),
    },
    issue: { path: "options", message: "Tandai tepat satu kunci jawaban." },
  },
];

describe("questionInput (card S1-09 §1)", () => {
  it("accepts a minimal PG input and TRIMS every text", () => {
    const parsed = questionInput.parse({
      ...PG,
      text: "  Soal pertanyaan  ",
      explanation: " Pembahasan jawaban ",
      options: PG.options.map((option, index) => ({
        ...option,
        text: `  Opsi ${index + 1}  `,
      })),
    });
    expect(parsed.text).toBe("Soal pertanyaan");
    expect(parsed.explanation).toBe("Pembahasan jawaban");
    expect(parsed.options.map((option) => option.text)).toEqual([
      "Opsi 1",
      "Opsi 2",
      "Opsi 3",
      "Opsi 4",
    ]);
  });

  it("accepts a minimal B/S input", () => {
    expect(questionInput.parse(BS).type).toBe("TRUE_FALSE");
  });

  it.each(PG_FAIL)("PG rejects: $name", ({ input, issue }) => {
    const result = questionInput.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (entry) =>
            entry.path.join(".") === issue.path &&
            entry.message === issue.message,
        ),
      ).toBe(true);
    }
  });

  it.each(BS_FAIL)("B/S rejects: $name", ({ input, issue }) => {
    const result = questionInput.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (entry) =>
            entry.path.join(".") === issue.path &&
            entry.message === issue.message,
        ),
      ).toBe(true);
    }
  });

  it("strictObject: an extra top-level key is rejected", () => {
    expect(questionInput.safeParse({ ...PG,Points: 2 }).success).toBe(false);
  });

  it("strictObject: an extra option key is rejected", () => {
    expect(
      questionInput.safeParse({
        ...PG,
        options: PG.options.map((option) => ({ ...option, weight: 1 })),
      }).success,
    ).toBe(false);
  });

  it("collects multiple issues at once (empty text + no key)", () => {
    const result = questionInput.safeParse({
      ...PG,
      text: "",
      options: PG.options.map((option) => ({ ...option, isCorrect: false })),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["text", "options"]),
      );
    }
  });
});
