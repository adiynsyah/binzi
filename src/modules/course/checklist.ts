/*
 * Publish checklist (card S1-02 §5, CMS-06): a PURE evaluator — no DB, no
 * "server-only" — so it is unit-testable directly and reusable as the S1-08
 * server gate ("Kirim & terbitkan"). The builder passes it row summaries;
 * the labels below are the exact UI copy (card §5, "label persis seperti
 * ini").
 */

/**
 * Cover requirement visibility (decision 3 Nov): hidden until S1-07 lands
 * the cover/alt-text feature, so a course can publish for the 20 Nov demo
 * without images. While false, item 5 is not returned at all and the total
 * is 6 (the "m / 6" of 21g).
 */
export const COVER_REQUIREMENT_ENABLED = false;

export type ChecklistLessonInput = {
  orderIndex: number;
  isContentEmpty: boolean;
  quizQuestionCount: number;
};

export type PublishChecklistInput = {
  title: string;
  level: string;
  summary: string | null;
  slug: string;
  isDescriptionEmpty: boolean;
  /** Cover presence for item 5 — read only once covers exist (S1-07). */
  hasCover?: boolean;
  lessons: ChecklistLessonInput[];
  finalQuizQuestionCount: number;
  /** From system_settings quiz.min_questions (quiz module, fail-closed). */
  minQuestions: number;
};

export type PublishChecklistItem = {
  key: string;
  label: string;
  met: boolean;
};

export type PublishChecklist = {
  items: PublishChecklistItem[];
  /** How many items are met ("m" of the "m / 6" header). */
  met: number;
  total: number;
  /** Human-readable shortage lines (the "n syarat belum lengkap" block). */
  missing: string[];
};

export type EvaluateChecklistOptions = {
  /** Test-only override of COVER_REQUIREMENT_ENABLED. */
  coverRequired?: boolean;
};

export function evaluatePublishChecklist(
  input: PublishChecklistInput,
  options: EvaluateChecklistOptions = {},
): PublishChecklist {
  const coverRequired = options.coverRequired ?? COVER_REQUIREMENT_ENABLED;

  // Item 3 is satisfied by a filled slug: uniqueness is GUARANTEED by the
  // courses_slug_unique constraint (S1-01) — a saved course can never hold
  // a duplicate slug, so re-checking the table here would prove nothing.
  const items: PublishChecklistItem[] = [
    { key: "title-level", label: "Judul & level", met: input.title.trim().length > 0 && input.level.trim().length > 0 },
    { key: "summary", label: "Ringkasan", met: input.summary !== null && input.summary.trim().length > 0 },
    { key: "slug", label: "Slug unik", met: input.slug.trim().length > 0 },
    { key: "description", label: "Deskripsi lengkap", met: !input.isDescriptionEmpty },
  ];

  if (coverRequired) {
    // No shortage line exists for the cover yet — S1-07 adds the real
    // input (thumbnail + alt text) together with its message.
    items.push({ key: "cover", label: "Sampul + teks alternatif", met: input.hasCover === true });
  }

  // CRS-08 makes EVERY lesson load-bearing: with sequential material, one
  // quiz without questions locks the next lesson forever — hence `every`,
  // not `some` (decision 4 Nov).
  const lessonsComplete =
    input.lessons.length >= 1 &&
    input.lessons.every(
      (lesson) =>
        !lesson.isContentEmpty &&
        lesson.quizQuestionCount >= input.minQuestions,
    );
  items.push({
    key: "lessons",
    label: "Semua materi lengkap (teks + quiz)",
    met: lessonsComplete,
  });

  items.push({
    key: "final-quiz",
    label: `Final Quiz ≥ ${input.minQuestions} soal`,
    met: input.finalQuizQuestionCount >= input.minQuestions,
  });

  // Deliberate deviation from 21a: video shortages are NOT listed here —
  // video is optional (CRS-03) and only shows as the row marker in the
  // outline. Noted in the PR.
  const missing: string[] = [];
  if (input.isDescriptionEmpty) {
    missing.push("Deskripsi kursus belum diisi");
  }
  if (input.lessons.length === 0) {
    missing.push("Belum ada materi");
  } else {
    for (const lesson of input.lessons) {
      if (lesson.isContentEmpty) {
        missing.push(`Materi ${lesson.orderIndex} belum punya teks isi`);
      }
      if (lesson.quizQuestionCount === 0) {
        missing.push(`Materi ${lesson.orderIndex} belum punya quiz`);
      } else if (lesson.quizQuestionCount < input.minQuestions) {
        missing.push(
          `Quiz materi ${lesson.orderIndex} baru ${lesson.quizQuestionCount} dari ${input.minQuestions} soal`,
        );
      }
    }
  }
  if (input.finalQuizQuestionCount < input.minQuestions) {
    missing.push(
      `Final Quiz baru ${input.finalQuizQuestionCount} dari ${input.minQuestions} soal`,
    );
  }

  return {
    items,
    met: items.filter((item) => item.met).length,
    total: items.length,
    missing,
  };
}
