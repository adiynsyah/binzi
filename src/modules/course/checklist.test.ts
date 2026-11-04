// evaluatePublishChecklist (card S1-02 §5 "Selesai jika"): every item met
// and unmet, totals 6/7, the every-lesson rule, the minQuestions label and
// every shortage line. Pure unit — no database.
import { describe, expect, it } from "vitest";

import { evaluatePublishChecklist, type PublishChecklistInput } from "./checklist";

const MIN = 10;

function baseInput(
  overrides: Partial<PublishChecklistInput> = {},
): PublishChecklistInput {
  return {
    title: "Kursus Contoh",
    level: "BEGINNER",
    summary: "Ringkasan.",
    slug: "kursus-contoh",
    isDescriptionEmpty: false,
    lessons: [
      { orderIndex: 1, isContentEmpty: false, quizQuestionCount: MIN },
    ],
    finalQuizQuestionCount: MIN,
    minQuestions: MIN,
    ...overrides,
  };
}

/** Everything met except what the override breaks. */
function resultFor(overrides: Partial<PublishChecklistInput>) {
  return evaluatePublishChecklist(baseInput(overrides));
}

describe("evaluatePublishChecklist — totals", () => {
  it("hides the cover item while COVER_REQUIREMENT_ENABLED = false → total 6", () => {
    const result = evaluatePublishChecklist(baseInput());
    expect(result.total).toBe(6);
    expect(result.items.map((item) => item.key)).not.toContain("cover");
    expect(result.met).toBe(6);
    expect(result.missing).toEqual([]);
  });

  it("coverRequired: true → 7 items including the cover", () => {
    const result = evaluatePublishChecklist(baseInput(), {
      coverRequired: true,
    });
    expect(result.total).toBe(7);
    expect(result.items.map((item) => item.key)).toContain("cover");
    expect(result.met).toBe(6); // cover unmet: hasCover defaults to false
    expect(result.missing).toEqual([]);
  });

  it("coverRequired: true and hasCover → 7 met", () => {
    const result = evaluatePublishChecklist(baseInput({ hasCover: true }), {
      coverRequired: true,
    });
    expect(result.met).toBe(7);
  });
});

describe("evaluatePublishChecklist — per item", () => {
  it("Judul & level: unmet on an empty title", () => {
    const item = resultFor({ title: "  " }).items.find((i) => i.key === "title-level");
    expect(item?.met).toBe(false);
  });

  it("Judul & level: unmet on an empty level", () => {
    const item = resultFor({ level: "" }).items.find((i) => i.key === "title-level");
    expect(item?.met).toBe(false);
  });

  it("Ringkasan: unmet on null and on whitespace", () => {
    expect(resultFor({ summary: null }).items.find((i) => i.key === "summary")?.met).toBe(false);
    expect(resultFor({ summary: "  " }).items.find((i) => i.key === "summary")?.met).toBe(false);
  });

  it("Slug unik: unmet on an empty slug", () => {
    expect(resultFor({ slug: "" }).items.find((i) => i.key === "slug")?.met).toBe(false);
  });

  it("Deskripsi lengkap: unmet when the description doc is empty", () => {
    const result = resultFor({ isDescriptionEmpty: true });
    expect(result.items.find((i) => i.key === "description")?.met).toBe(false);
    expect(result.missing).toContain("Deskripsi kursus belum diisi");
  });

  it("Semua materi lengkap: zero lessons → unmet + 'Belum ada materi'", () => {
    const result = resultFor({ lessons: [] });
    expect(result.items.find((i) => i.key === "lessons")?.met).toBe(false);
    expect(result.missing).toContain("Belum ada materi");
  });

  it("Semua materi lengkap: ONE of two incomplete lessons → unmet (every, not some)", () => {
    const result = resultFor({
      lessons: [
        { orderIndex: 1, isContentEmpty: false, quizQuestionCount: MIN },
        { orderIndex: 2, isContentEmpty: false, quizQuestionCount: 0 },
      ],
    });
    expect(result.items.find((i) => i.key === "lessons")?.met).toBe(false);
    expect(result.missing).toContain("Materi 2 belum punya quiz");
  });

  it("Semua materi lengkap: a lesson with empty text → unmet + line", () => {
    const result = resultFor({
      lessons: [
        { orderIndex: 1, isContentEmpty: true, quizQuestionCount: MIN },
      ],
    });
    expect(result.items.find((i) => i.key === "lessons")?.met).toBe(false);
    expect(result.missing).toContain("Materi 1 belum punya teks isi");
  });

  it("quiz min − 1 questions → unmet + 'Quiz materi n baru k dari {min} soal'", () => {
    const result = resultFor({
      lessons: [
        { orderIndex: 3, isContentEmpty: false, quizQuestionCount: MIN - 1 },
      ],
    });
    expect(result.items.find((i) => i.key === "lessons")?.met).toBe(false);
    expect(result.missing).toContain(
      `Quiz materi 3 baru ${MIN - 1} dari ${MIN} soal`,
    );
  });

  it("Final Quiz label interpolates minQuestions", () => {
    const result = evaluatePublishChecklist(baseInput({ minQuestions: 5 }));
    expect(result.items.find((i) => i.key === "final-quiz")?.label).toBe(
      "Final Quiz ≥ 5 soal",
    );
  });

  it("Final Quiz min − 1 → unmet + 'Final Quiz baru n dari {min} soal'", () => {
    const result = resultFor({ finalQuizQuestionCount: MIN - 1 });
    expect(result.items.find((i) => i.key === "final-quiz")?.met).toBe(false);
    expect(result.missing).toContain(
      `Final Quiz baru ${MIN - 1} dari ${MIN} soal`,
    );
  });
});

describe("evaluatePublishChecklist — a realistic builder snapshot", () => {
  it("a freshly created course (21g) is 3 / 6", () => {
    const result = evaluatePublishChecklist(
      baseInput({
        isDescriptionEmpty: true,
        lessons: [],
        finalQuizQuestionCount: 0,
      }),
    );
    expect(result.met).toBe(3);
    expect(result.total).toBe(6);
    expect(result.missing).toEqual([
      "Deskripsi kursus belum diisi",
      "Belum ada materi",
      "Final Quiz baru 0 dari 10 soal",
    ]);
  });
});
