// Serializer tests (card S3-01 §1): the seeded option orderer (decision 8),
// the allowlist proofs — the running DTO carries NO grading keys anywhere
// (recursive scan, mutation 1) — the rules DTO's allSingleChoice rule
// (owner addendum), and the result DTO's policy gate (the key and the
// explanation hide together), counts, and expiry-capped duration. Runs
// without a database (no runtime db imports in the module under test).
import { describe, expect, it } from "vitest";

import {
  orderOptions,
  questionsInAttemptOrder,
  reviewAccessOf,
  toFinalQuizResultDTO,
  toGradesPageDTO,
  toQuizResultDTO,
  toQuizRunningDTO,
  toQuizRulesDTO,
  type AttemptAnswerRow,
  type AttemptOptionRow,
  type AttemptQuestionRow,
  type AttemptRow,
  type GradeCourseRow,
  type GradeFinalAttemptInput,
  type GradeQuizSettingsInput,
  type QuizSettingsRow,
} from "./serializer";

const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";
const QUIZ_ID = "22222222-2222-4222-8222-222222222222";
const LESSON_HREF = "/belajar/gizi-seimbang/materi-1";

function questionRow(
  index: number,
  overrides: Partial<AttemptQuestionRow> = {},
): AttemptQuestionRow {
  return {
    id: `q-${index}`,
    orderIndex: index,
    type: "SINGLE_CHOICE",
    text: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: `Soal ${index}` }] },
      ],
    },
    explanation: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: `Pembahasan ${index}` }],
        },
      ],
    },
    points: 1,
    ...overrides,
  };
}

/** Options "alpha/beta/gamma/delta" with `correctIndex` the key. */
function optionRows(
  questionId: string,
  correctIndex: number,
  count = 4,
): AttemptOptionRow[] {
  const words = ["alpha", "beta", "gamma", "delta"];
  return Array.from({ length: count }, (_, index) => ({
    questionId,
    id: `o-${questionId}-${index}`,
    orderIndex: index,
    text: `Opsi ${words[index]!}`,
    isCorrect: index === correctIndex,
  }));
}

function settingsRow(
  overrides: Partial<QuizSettingsRow> = {},
): QuizSettingsRow {
  return {
    id: QUIZ_ID,
    // Card S5-02 §2: LESSON by default — the Final serializer tests pass
    // type: "FINAL" explicitly.
    type: "LESSON",
    title: "Quiz materi 1",
    durationMinutes: 10,
    passingScorePercent: 70,
    shuffleQuestions: false,
    shuffleOptions: true,
    explanationPolicy: "ALWAYS",
    ...overrides,
  };
}

function attemptRow(overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id: ATTEMPT_ID,
    quizId: QUIZ_ID,
    userId: "u-member",
    enrollmentId: "enr-1",
    status: "SUBMITTED",
    questionOrder: ["q-1", "q-2"],
    startedAt: new Date("2026-11-18T08:00:00Z"),
    expiresAt: new Date("2026-11-18T08:10:00Z"),
    submittedAt: new Date("2026-11-18T08:07:30Z"),
    score: 1,
    maxScore: 2,
    scorePercent: "50.00",
    isPassed: false,
    ...overrides,
  };
}

function answerRow(
  questionId: string,
  selectedOptionId: string | null,
): AttemptAnswerRow {
  return { questionId, selectedOptionId };
}

/** Collect EVERY key of every object in the value, recursively. */
function deepKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) deepKeys(item, into);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      deepKeys(child, into);
    }
  }
  return into;
}

// ------------------------------------------------------------- orderOptions

describe("orderOptions", () => {
  const options = optionRows("q-1", 1);

  it("same seed → the exact same order, twice (deterministic)", () => {
    const first = orderOptions(options, {
      attemptId: ATTEMPT_ID,
      questionId: "q-1",
      type: "SINGLE_CHOICE",
      shuffle: true,
    });
    const second = orderOptions(options, {
      attemptId: ATTEMPT_ID,
      questionId: "q-1",
      type: "SINGLE_CHOICE",
      shuffle: true,
    });
    expect(first).toEqual(second);
  });

  it("is a permutation of the input ids with labels A–D assigned AFTER the sort", () => {
    const ordered = orderOptions(options, {
      attemptId: ATTEMPT_ID,
      questionId: "q-1",
      type: "SINGLE_CHOICE",
      shuffle: true,
    });
    expect(ordered.map((option) => option.id).sort()).toEqual(
      options.map((option) => option.id).sort(),
    );
    expect(ordered.map((option) => option.label)).toEqual(["A", "B", "C", "D"]);
  });

  it("TRUE_FALSE is never shuffled — storage order wins even with shuffle on", () => {
    const ordered = orderOptions(optionRows("q-9", 0, 2), {
      attemptId: ATTEMPT_ID,
      questionId: "q-9",
      type: "TRUE_FALSE",
      shuffle: true,
    });
    expect(ordered.map((option) => option.text)).toEqual([
      "Opsi alpha",
      "Opsi beta",
    ]);
  });

  it("shuffle false keeps storage order; isCorrect never appears in the output", () => {
    const ordered = orderOptions(options, {
      attemptId: ATTEMPT_ID,
      questionId: "q-1",
      type: "SINGLE_CHOICE",
      shuffle: false,
    });
    expect(ordered.map((option) => option.id)).toEqual(
      options.map((option) => option.id),
    );
    for (const option of ordered) {
      expect(Object.keys(option).sort()).toEqual(["id", "label", "text"]);
    }
  });

  it("a different attempt seed can produce a different order (the seed matters)", () => {
    const seeds = ["1", "2", "3", "4", "5", "6"].map((digit) => ({
      attemptId: `33333333-3333-4333-8333-33333333333${digit}`,
      questionId: "q-1",
      type: "SINGLE_CHOICE" as const,
      shuffle: true,
    }));
    const orders = new Set(
      seeds.map((config) =>
        JSON.stringify(
          orderOptions(options, config).map((option) => option.id),
        ),
      ),
    );
    // With 6 different seeds over 24 permutations, expecting >1 distinct
    // order is safe; a fixed order would mean the seed is ignored.
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("questionsInAttemptOrder", () => {
  it("follows question_order, not order_index, and drops unknown ids", () => {
    const rows = [questionRow(1), questionRow(2), questionRow(3)];
    const ordered = questionsInAttemptOrder(rows, ["q-3", "q-1", "q-77"]);
    expect(ordered.map((row) => row.id)).toEqual(["q-3", "q-1"]);
  });
});

// ------------------------------------------------------------ the rules DTO

describe("toQuizRulesDTO", () => {
  it("returns exactly the allowlisted keys with the quiz settings", () => {
    const dto = toQuizRulesDTO({
      lessonId: "lesson-1",
      lessonPosition: 2,
      lessonTitle: "Judul materi 2",
      settings: settingsRow(),
      questionRows: [questionRow(1), questionRow(2)],
      lessonHref: LESSON_HREF,
    });
    expect(dto).toEqual({
      state: "aturan",
      lessonId: "lesson-1",
      quizTitle: "Quiz materi 1",
      lessonPosition: 2,
      lessonTitle: "Judul materi 2",
      questionCount: 2,
      durationMinutes: 10,
      passingScorePercent: 70,
      explanationPolicy: "ALWAYS",
      allSingleChoice: true,
      lessonHref: LESSON_HREF,
    });
  });

  it("allSingleChoice: one TRUE_FALSE question is enough to make it false", () => {
    // Owner addendum: rule 01 says "pilihan ganda" only when EVERY question
    // is SINGLE_CHOICE — over ALL of the quiz's questions (no attempt
    // exists yet in the rules state).
    const dto = toQuizRulesDTO({
      lessonId: "lesson-1",
      lessonPosition: 1,
      lessonTitle: "Judul materi 1",
      settings: settingsRow(),
      questionRows: [
        questionRow(1),
        questionRow(2),
        questionRow(3, { type: "TRUE_FALSE" }),
      ],
      lessonHref: LESSON_HREF,
    });
    expect(dto.allSingleChoice).toBe(false);
    expect(dto.questionCount).toBe(3);
  });
});

// ---------------------------------------------------------- the running DTO

describe("toQuizRunningDTO", () => {
  const questionRows = [questionRow(1), questionRow(2, { points: 3 })];
  const optionRowsAll = [
    ...optionRows("q-1", 0),
    ...optionRows("q-2", 1, 2),
  ];
  const answerRows = [
    answerRow("q-1", "o-q-1-2"),
    answerRow("q-2", null),
  ];

  it("numbers questions by question_order and maps answers without nulls", () => {
    const dto = toQuizRunningDTO({
      heading: "Quiz Materi 2 · Judul materi 2",
      attemptId: ATTEMPT_ID,
      questionOrder: ["q-2", "q-1"],
      expiresAt: new Date("2026-11-18T08:10:00Z"),
      serverNow: new Date("2026-11-18T08:01:00Z"),
      settings: settingsRow({ shuffleOptions: false }),
      questionRows,
      optionRows: optionRowsAll,
      answerRows,
    });
    expect(dto.state).toBe("berjalan");
    expect(dto.heading).toBe("Quiz Materi 2 · Judul materi 2");
    expect(dto.attemptId).toBe(ATTEMPT_ID);
    expect(dto.expiresAt).toBe("2026-11-18T08:10:00.000Z");
    expect(dto.serverNow).toBe("2026-11-18T08:01:00.000Z");
    expect(dto.questions.map((question) => question.number)).toEqual([1, 2]);
    expect(dto.questions[0]!.id).toBe("q-2");
    expect(dto.questions[0]!.text).toBe("Soal 2");
    // q-2 is TRUE_FALSE-shaped here only by option count; options keep
    // storage order with shuffle off, labels after.
    expect(dto.questions[0]!.options.map((option) => option.label)).toEqual([
      "A",
      "B",
    ]);
    expect(dto.answers).toEqual({ "q-1": "o-q-1-2" });
  });

  it("carries NO grading key anywhere in the DTO (recursive scan, mutation 1)", () => {
    const dto = toQuizRunningDTO({
      heading: "Quiz Materi 1 · Judul materi 1",
      attemptId: ATTEMPT_ID,
      questionOrder: ["q-1", "q-2"],
      expiresAt: new Date("2026-11-18T08:10:00Z"),
      serverNow: new Date("2026-11-18T08:01:00Z"),
      settings: settingsRow(),
      questionRows,
      optionRows: optionRowsAll,
      answerRows,
    });
    const keys = deepKeys(dto);
    expect(keys.has("isCorrect")).toBe(false);
    expect(keys.has("explanation")).toBe(false);
    expect(keys.has("points")).toBe(false);
    expect(keys.has("correct")).toBe(false);
    expect(keys.has("score")).toBe(false);
    expect(JSON.stringify(dto)).not.toContain("Pembahasan");
  });

  it("the top-level key allowlist is exact, heading included (card S3-02 §1e)", () => {
    const dto = toQuizRunningDTO({
      heading: "Quiz Materi 1 · Judul materi 1",
      attemptId: ATTEMPT_ID,
      questionOrder: ["q-1"],
      expiresAt: new Date("2026-11-18T08:10:00Z"),
      serverNow: new Date("2026-11-18T08:01:00Z"),
      settings: settingsRow(),
      questionRows: [questionRows[0]!],
      optionRows: optionRowsAll.filter((o) => o.questionId === "q-1"),
      answerRows: [],
    });
    expect(Object.keys(dto).sort()).toEqual(
      [
        "state",
        "heading",
        "attemptId",
        "expiresAt",
        "serverNow",
        "questions",
        "answers",
      ].sort(),
    );
  });

  it("options use the attempt:question seed — same order as a later result build", () => {
    const config = {
      heading: "Quiz Materi 1 · Judul materi 1",
      attemptId: ATTEMPT_ID,
      questionOrder: ["q-1"] as const,
      expiresAt: new Date("2026-11-18T08:10:00Z"),
      serverNow: new Date("2026-11-18T08:01:00Z"),
      settings: settingsRow({ shuffleOptions: true }),
      questionRows: [questionRows[0]!],
      optionRows: optionRowsAll.filter((o) => o.questionId === "q-1"),
      answerRows: [],
    };
    const running = toQuizRunningDTO(config);
    const result = toQuizResultDTO({
      attempt: attemptRow({ questionOrder: ["q-1"], submittedAt: null, status: "EXPIRED" }),
      settings: settingsRow({ shuffleOptions: true }),
      questionRows: [questionRows[0]!],
      optionRows: optionRowsAll.filter((o) => o.questionId === "q-1"),
      answerRows: [],
      lesson: { position: 1, title: "Judul materi 1", href: LESSON_HREF },
      next: null,
      finalQuizHref: null,
      finalQuizDone: false,
    });
    expect(result.items[0]!.options.map((option) => option.label)).toEqual(
      running.questions[0]!.options.map((option) => option.label),
    );
    expect(result.items[0]!.options.map((option) => option.text)).toEqual(
      running.questions[0]!.options.map((option) => option.text),
    );
  });
});

// ---------------------------------------------------------- the result DTO

describe("toQuizResultDTO", () => {
  /** Two questions: q-1 answered CORRECT (option 0), q-2 answered WRONG
   *  (option 0 while the key is option 1), q-3 left unanswered. */
  function gradedFixture(overrides: {
    explanationPolicy: QuizSettingsRow["explanationPolicy"];
    scorePercent?: string;
    isPassed?: boolean | null;
    submittedAt?: Date | null;
    status?: AttemptRow["status"];
    finalQuizDone?: boolean;
  }) {
    const questionRows = [
      questionRow(1, { points: 2 }),
      questionRow(2, { points: 1 }),
      questionRow(3, { points: 4, explanation: null }),
    ];
    const options = [
      ...optionRows("q-1", 0),
      ...optionRows("q-2", 1, 2),
      ...optionRows("q-3", 0),
    ];
    return toQuizResultDTO({
      attempt: attemptRow({
        questionOrder: ["q-1", "q-2", "q-3"],
        score: 2,
        maxScore: 7,
        scorePercent: overrides.scorePercent ?? "28.57",
        isPassed: overrides.isPassed ?? false,
        submittedAt:
          overrides.submittedAt === undefined
            ? new Date("2026-11-18T08:07:30Z")
            : overrides.submittedAt,
        status: overrides.status ?? "SUBMITTED",
      }),
      settings: settingsRow({
        explanationPolicy: overrides.explanationPolicy,
        shuffleOptions: false,
      }),
      questionRows,
      optionRows: options,
      answerRows: [answerRow("q-1", "o-q-1-0"), answerRow("q-2", "o-q-2-0")],
      lesson: { position: 1, title: "Judul materi 1", href: LESSON_HREF },
      next: { position: 2, href: "/belajar/gizi-seimbang/materi-2" },
      finalQuizHref: null,
      finalQuizDone: overrides.finalQuizDone ?? false,
    });
  }

  it("counts correct/wrong/unanswered from the same rows the grade used", () => {
    const dto = gradedFixture({ explanationPolicy: "ALWAYS" });
    expect(dto.state).toBe("hasil");
    expect(dto.status).toBe("SUBMITTED");
    expect(dto.correct).toBe(1);
    expect(dto.wrong).toBe(1);
    expect(dto.unanswered).toBe(1);
    expect(dto.scorePercent).toBe(28); // "28.57" FLOORS to 28 (S3-02 §3)
    expect(dto.isPassed).toBe(false);
    expect(dto.durationSeconds).toBe(450); // 08:00:00 → 08:07:30
    expect(dto.lesson).toEqual({
      position: 1,
      title: "Judul materi 1",
      href: LESSON_HREF,
    });
    expect(dto.next).toEqual({
      position: 2,
      href: "/belajar/gizi-seimbang/materi-2",
    });
  });

  it("FLOORS scorePercent: 69.5 → 69, 69.99 → 69, 70 → 70 (never rounds up)", () => {
    // Card S3-02 §3: a 69.95 % attempt must not read as 70 next to a
    // "lulus di ≥ 70" verdict — same for the exact .5 and .99 cases.
    expect(
      gradedFixture({ explanationPolicy: "ALWAYS", scorePercent: "69.50" })
        .scorePercent,
    ).toBe(69);
    expect(
      gradedFixture({ explanationPolicy: "ALWAYS", scorePercent: "69.99" })
        .scorePercent,
    ).toBe(69);
    expect(
      gradedFixture({ explanationPolicy: "ALWAYS", scorePercent: "70.00" })
        .scorePercent,
    ).toBe(70);
  });

  it("passes finalQuizDone through untouched (the closing's swap, S3-02 §5)", () => {
    expect(gradedFixture({ explanationPolicy: "ALWAYS" }).finalQuizDone).toBe(
      false,
    );
    expect(
      gradedFixture({ explanationPolicy: "ALWAYS", finalQuizDone: true })
        .finalQuizDone,
    ).toBe(true);
  });

  it("ALWAYS: marks selected + correct on the options and shows explanations", () => {
    const dto = gradedFixture({ explanationPolicy: "ALWAYS" });
    const first = dto.items[0]!;
    expect(first.options.map((option) => option.selected)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(first.options.map((option) => option.correct)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(first.explanation).toBe("Pembahasan 1");
    // A question with explanation NULL in the db reads null, not "".
    expect(dto.items[2]!.explanation).toBeNull();
  });

  it("ON_PASS_ONLY + passed: the key and the explanation show; + failed: BOTH hide together", () => {
    const passed = gradedFixture({
      explanationPolicy: "ON_PASS_ONLY",
      isPassed: true,
    });
    expect(passed.reviewAccess).toBe("PASSED");
    expect(passed.items[0]!.options[0]!.correct).toBe(true);
    expect(passed.items[0]!.explanation).toBe("Pembahasan 1");

    const failed = gradedFixture({
      explanationPolicy: "ON_PASS_ONLY",
      isPassed: false,
    });
    expect(failed.reviewAccess).toBe("HIDDEN_NOT_PASSED");
    expect(failed.items[0]!.options.every((option) => option.correct === null))
      .toBe(true);
    expect(failed.items.every((item) => item.explanation === null)).toBe(true);
  });

  it("NEVER: correct is null and explanations are null (no key leak)", () => {
    const dto = gradedFixture({ explanationPolicy: "NEVER" });
    expect(dto.reviewAccess).toBe("HIDDEN_NEVER");
    expect(dto.items.every((item) => item.explanation === null)).toBe(true);
    expect(
      dto.items.every((item) =>
        item.options.every((option) => option.correct === null),
      ),
    ).toBe(true);
    // The participant's own answers still show.
    expect(dto.items[1]!.options[0]!.selected).toBe(true);
  });

  it("reviewAccess maps all four states: ALWAYS, PASSED, HIDDEN_NEVER, HIDDEN_NOT_PASSED", () => {
    // The screens pick their copy from this ONE value (card S3-02 §3) —
    // pin the full mapping, not just the two hidden cases above.
    expect(gradedFixture({ explanationPolicy: "ALWAYS" }).reviewAccess).toBe(
      "ALWAYS",
    );
    expect(
      gradedFixture({ explanationPolicy: "ON_PASS_ONLY", isPassed: true })
        .reviewAccess,
    ).toBe("PASSED");
    expect(
      gradedFixture({ explanationPolicy: "NEVER" }).reviewAccess,
    ).toBe("HIDDEN_NEVER");
    expect(
      gradedFixture({ explanationPolicy: "ON_PASS_ONLY", isPassed: false })
        .reviewAccess,
    ).toBe("HIDDEN_NOT_PASSED");
  });

  it("HIDDEN_*: no per-question right/wrong data anywhere in the DTO (recursive value scan)", () => {
    // deepKeys proves the KEY never appears; this walks the VALUES — under
    // a hidden policy, an option's `correct` must be null at EVERY depth.
    // Scoped to dto.items: the top-level `correct` is the aggregate
    // counter the score card shows, not per-question data.
    function deepCorrectIsAlwaysNull(value: unknown): boolean {
      if (Array.isArray(value)) {
        return value.every(deepCorrectIsAlwaysNull);
      }
      if (value !== null && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          if (key === "correct" && child !== null) return false;
          if (!deepCorrectIsAlwaysNull(child)) return false;
        }
      }
      return true;
    }
    for (const dto of [
      gradedFixture({ explanationPolicy: "NEVER" }),
      gradedFixture({ explanationPolicy: "ON_PASS_ONLY", isPassed: false }),
    ]) {
      expect(deepCorrectIsAlwaysNull(dto.items)).toBe(true);
    }
  });

  it("EXPIRED: duration caps at expires_at even when submittedAt landed later", () => {
    const dto = gradedFixture({
      explanationPolicy: "ALWAYS",
      status: "EXPIRED",
      submittedAt: new Date("2026-11-18T08:10:05Z"), // 5 s past expiry
    });
    expect(dto.status).toBe("EXPIRED");
    expect(dto.durationSeconds).toBe(600); // 08:00:00 → 08:10:00, capped
  });

  it("the lesson-result allowlist is exact: review keys + state + pointers", () => {
    const dto = gradedFixture({ explanationPolicy: "ALWAYS" });
    expect(Object.keys(dto).sort()).toEqual(
      [
        "state",
        "reviewAccess",
        "status",
        "scorePercent",
        "isPassed",
        "correct",
        "wrong",
        "unanswered",
        "durationSeconds",
        "items",
        "lesson",
        "next",
        "finalQuizHref",
        "finalQuizDone",
      ].sort(),
    );
  });

  it("items follow question_order numbering, not order_index", () => {
    const dto = gradedFixture({ explanationPolicy: "ALWAYS" });
    expect(dto.items.map((item) => item.number)).toEqual([1, 2, 3]);
  });
});

// ------------------------------------------- toFinalQuizResultDTO (S5-02 §2)

describe("toFinalQuizResultDTO", () => {
  /** The SAME graded rows the lesson-result tests use, under a FINAL quiz. */
  function finalFixture(overrides: {
    isPassed?: boolean | null;
    scorePercent?: string;
  }) {
    return toFinalQuizResultDTO({
      attempt: attemptRow({
        questionOrder: ["q-1", "q-2", "q-3"],
        score: 2,
        maxScore: 7,
        scorePercent: overrides.scorePercent ?? "28.57",
        isPassed: overrides.isPassed ?? false,
      }),
      settings: settingsRow({
        type: "FINAL",
        explanationPolicy: "ALWAYS",
        shuffleOptions: false,
      }),
      questionRows: [
        questionRow(1, { points: 2 }),
        questionRow(2, { points: 1 }),
        questionRow(3, { points: 4, explanation: null }),
      ],
      optionRows: [
        ...optionRows("q-1", 0),
        ...optionRows("q-2", 1, 2),
        ...optionRows("q-3", 0),
      ],
      answerRows: [answerRow("q-1", "o-q-1-0"), answerRow("q-2", "o-q-2-0")],
      final: {
        durationLimitSeconds: 1200,
        passingScorePercent: 70,
        lessonAveragePercent: 60,
        weights: { lessonPercent: 60, finalPercent: 40 },
        finalScorePercent: 68,
        courseStatus: "PASSED",
      },
    });
  }

  it("carries the SHARED review half — identical numbers to the lesson result", () => {
    const dto = finalFixture({});
    expect(dto.state).toBe("hasil-final");
    expect(dto.status).toBe("SUBMITTED");
    expect(dto.scorePercent).toBe(28); // "28.57" floors to 28 (S3-02 §3)
    expect(dto.reviewAccess).toBe("ALWAYS");
    expect(dto.isPassed).toBe(false);
    expect(dto.correct).toBe(1);
    expect(dto.wrong).toBe(1);
    expect(dto.unanswered).toBe(1);
    expect(dto.durationSeconds).toBe(450);
    expect(dto.items).toHaveLength(3);
  });

  it("passes the course half through untouched (formula inputs + stored result)", () => {
    const dto = finalFixture({ isPassed: true, scorePercent: "80.00" });
    expect(dto.final).toEqual({
      durationLimitSeconds: 1200,
      passingScorePercent: 70,
      lessonAveragePercent: 60,
      weights: { lessonPercent: 60, finalPercent: 40 },
      finalScorePercent: 68,
      courseStatus: "PASSED",
    });
    // courseStatus is a VALUE from the submit, not derived here: the same
    // builder carries COMPLETED for a failed final attempt.
    const failed = toFinalQuizResultDTO({
      attempt: attemptRow(),
      settings: settingsRow({ type: "FINAL" }),
      questionRows: [questionRow(1)],
      optionRows: optionRows("q-1", 0),
      answerRows: [],
      final: {
        durationLimitSeconds: 1200,
        passingScorePercent: 70,
        lessonAveragePercent: 75,
        weights: { lessonPercent: 60, finalPercent: 40 },
        finalScorePercent: 69,
        courseStatus: "COMPLETED",
      },
    });
    expect(failed.final.courseStatus).toBe("COMPLETED");
    expect(failed.final.lessonAveragePercent).toBe(75);
  });

  it("the allowlist is exact: review keys + state + final, nothing else", () => {
    const dto = finalFixture({});
    expect(Object.keys(dto).sort()).toEqual(
      [
        "state",
        "reviewAccess",
        "status",
        "scorePercent",
        "isPassed",
        "correct",
        "wrong",
        "unanswered",
        "durationSeconds",
        "items",
        "final",
      ].sort(),
    );
    expect(Object.keys(dto.final).sort()).toEqual(
      [
        "durationLimitSeconds",
        "passingScorePercent",
        "lessonAveragePercent",
        "weights",
        "finalScorePercent",
        "courseStatus",
      ].sort(),
    );
  });
});

// ------------------------------------------------------------- S5-03 grades

describe("reviewAccessOf", () => {
  it("maps the four policy branches (card S3-02 §3, lifted for S5-03 §2)", () => {
    expect(reviewAccessOf("ALWAYS", false)).toBe("ALWAYS");
    expect(reviewAccessOf("NEVER", true)).toBe("HIDDEN_NEVER");
    expect(reviewAccessOf("ON_PASS_ONLY", true)).toBe("PASSED");
    expect(reviewAccessOf("ON_PASS_ONLY", false)).toBe("HIDDEN_NOT_PASSED");
  });
});

describe("toGradesPageDTO", () => {
  function gradeCourseRow(
    overrides: Partial<GradeCourseRow> = {},
  ): GradeCourseRow {
    return {
      courseId: "c-1",
      courseTitle: "Gizi Seimbang",
      lessonCount: 2,
      enrollmentStatus: "PASSED",
      finalScorePercent: "68.00",
      completedAt: new Date("2026-11-18T09:00:00Z"),
      lastActivityAt: new Date("2026-11-18T09:00:00Z"),
      finalQuizId: "quiz-final",
      finalQuizHref: "/belajar/gizi-seimbang/final-quiz",
      allLessonsCompleted: true,
      lessons: [
        {
          position: 1,
          title: "Materi 1",
          quizId: "quiz-1",
          quizHref: "/belajar/gizi-seimbang/materi-1/quiz",
          unlocked: true,
          result: {
            scorePercent: "70.00",
            isPassed: true,
            submittedAt: new Date("2026-11-18T08:07:30Z"),
          },
        },
        {
          position: 2,
          title: "Materi 2",
          quizId: "quiz-2",
          quizHref: "/belajar/gizi-seimbang/materi-2/quiz",
          unlocked: true,
          result: {
            scorePercent: "50.00",
            isPassed: false,
            submittedAt: new Date("2026-11-18T08:20:00Z"),
          },
        },
      ],
      ...overrides,
    };
  }

  function defaultSettings(): Map<string, GradeQuizSettingsInput> {
    return new Map([
      ["quiz-1", { explanationPolicy: "ALWAYS", questionCount: 10 }],
      ["quiz-2", { explanationPolicy: "ON_PASS_ONLY", questionCount: 10 }],
      ["quiz-final", { explanationPolicy: "ALWAYS", questionCount: 5 }],
    ]);
  }

  function defaultFinalAttempts(): Map<string, GradeFinalAttemptInput> {
    return new Map([
      [
        "quiz-final",
        {
          scorePercent: "80.00",
          isPassed: true,
          submittedAt: new Date("2026-11-18T09:00:00Z"),
        },
      ],
    ]);
  }

  function gradesPage(
    courses: GradeCourseRow[],
    overrides: {
      settings?: Map<string, GradeQuizSettingsInput>;
      finalAttempts?: Map<string, GradeFinalAttemptInput>;
    } = {},
  ) {
    return toGradesPageDTO({
      courses,
      settings: overrides.settings ?? defaultSettings(),
      finalAttempts: overrides.finalAttempts ?? defaultFinalAttempts(),
      weights: { lessonPercent: 60, finalPercent: 40 },
    });
  }

  it("the four allowlists are exact — no quiz/lesson/attempt ids, no answers, no key", () => {
    const page = gradesPage([gradeCourseRow()]);
    expect(Object.keys(page).sort()).toEqual(["courses", "weights"].sort());
    const course = page.courses[0]!;
    expect(Object.keys(course).sort()).toEqual(
      [
        "id",
        "title",
        "lessonCount",
        "badge",
        "meta",
        "finalScorePercent",
        "lessonAveragePercent",
        "lessons",
        "lockedCount",
        "final",
        "nextStep",
      ].sort(),
    );
    expect(Object.keys(course.lessons[0]!).sort()).toEqual(
      ["position", "title", "result"].sort(),
    );
    const keys = deepKeys(course.lessons[0]!.result);
    expect([...keys].sort()).toEqual(
      [
        "scorePercent",
        "isPassed",
        "submittedAt",
        "reviewHref",
        "reviewAccess",
      ].sort(),
    );
    // The whole page carries no id-ish or grading key beyond course id.
    const pageKeys = deepKeys(page);
    for (const forbidden of [
      "quizId",
      "lessonId",
      "attemptId",
      "enrollmentId",
      "userId",
      "answers",
      "options",
      "explanation",
      "correct",
      "isCorrect",
      "points",
      "questionOrder",
    ]) {
      expect(pageKeys.has(forbidden), forbidden).toBe(false);
    }
  });

  it("rounds each number by ITS rule: lessons + Final floor, Nilai Akhir + average round", () => {
    const page = gradesPage([
      gradeCourseRow({
        finalScorePercent: "91.40",
        lessons: gradeCourseRow().lessons.map((lesson, index) =>
          index === 0
            ? { ...lesson, result: { ...lesson.result!, scorePercent: "69.99" } }
            : lesson,
        ),
      }),
    ]);
    const course = page.courses[0]!;
    expect(course.lessons[0]!.result!.scorePercent).toBe(69);
    expect(course.finalScorePercent).toBe(91);
    expect(course.lessonAveragePercent).toBe(60); // (69.99 + 50) / 2 = 59.995 → round
    expect(course.final!.result!.scorePercent).toBe(80);

    const rounded = gradesPage([
      gradeCourseRow({ finalScorePercent: "67.50" }),
    ]);
    expect(rounded.courses[0]!.finalScorePercent).toBe(68);
  });

  it("meta + finalScorePercent + nextStep follow the enrollment status", () => {
    const running = gradesPage([
      gradeCourseRow({
        enrollmentStatus: "IN_PROGRESS",
        finalScorePercent: "68.00",
        allLessonsCompleted: false,
        completedAt: null,
        lastActivityAt: new Date("2026-11-20T02:30:00Z"),
        finalQuizId: null,
        finalQuizHref: null,
        lessons: [gradeCourseRow().lessons[0]!],
      }),
    ]).courses[0]!;
    expect(running.badge).toBe("sedang-berjalan");
    expect(running.meta).toEqual({
      kind: "terakhir-diakses",
      at: "2026-11-20T02:30:00.000Z",
    });
    expect(running.finalScorePercent).toBeNull();
    expect(running.nextStep).toBe("materi");
    expect(running.final).toBeNull();

    const readyForFinal = gradesPage([
      gradeCourseRow({
        enrollmentStatus: "IN_PROGRESS",
        finalScorePercent: null,
        allLessonsCompleted: true,
        completedAt: null,
      }),
    ]).courses[0]!;
    expect(readyForFinal.nextStep).toBe("final");
    expect(readyForFinal.finalScorePercent).toBeNull();

    const done = gradesPage([gradeCourseRow()]).courses[0]!;
    expect(done.badge).toBe("lulus");
    expect(done.meta).toEqual({
      kind: "selesai",
      at: "2026-11-18T09:00:00.000Z",
    });
    expect(done.nextStep).toBeNull();

    const completedNoDate = gradesPage([
      gradeCourseRow({
        enrollmentStatus: "COMPLETED",
        completedAt: null,
        lastActivityAt: new Date("2026-11-19T10:00:00Z"),
      }),
    ]).courses[0]!;
    expect(completedNoDate.badge).toBe("selesai");
    expect(completedNoDate.meta).toEqual({
      kind: "selesai",
      at: "2026-11-19T10:00:00.000Z",
    });
  });

  it("drops a course without a single result and counts locked rows apart", () => {
    const noGrades = gradeCourseRow({
      enrollmentStatus: "IN_PROGRESS",
      finalQuizId: null,
      finalQuizHref: null,
      lessons: [
        {
          position: 1,
          title: "Materi 1",
          quizId: "quiz-1",
          quizHref: "/belajar/gizi-seimbang/materi-1/quiz",
          unlocked: true,
          result: null,
        },
      ],
    });
    const page = gradesPage([noGrades, gradeCourseRow()]);
    expect(page.courses).toHaveLength(1);
    expect(page.courses[0]!.title).toBe("Gizi Seimbang");

    const mixed = gradesPage([
      gradeCourseRow({
        enrollmentStatus: "IN_PROGRESS",
        finalQuizId: null,
        finalQuizHref: null,
        lessons: [
          gradeCourseRow().lessons[0]!,
          {
            position: 2,
            title: "Materi 2",
            quizId: "quiz-2",
            quizHref: "/belajar/gizi-seimbang/materi-2/quiz",
            unlocked: true,
            result: null,
          },
          {
            position: 3,
            title: "Materi 3",
            quizId: null,
            quizHref: null,
            unlocked: false,
            result: null,
          },
        ],
      }),
    ]).courses[0]!;
    expect(mixed.lessons.map((row) => row.position)).toEqual([1, 2]);
    expect(mixed.lessons[1]!.result).toBeNull();
    expect(mixed.lockedCount).toBe(1);
  });

  it("reviewAccess follows the ONE derivation; null isPassed reads false", () => {
    const course = gradesPage([gradeCourseRow()]).courses[0]!;
    expect(course.lessons[0]!.result!.reviewAccess).toBe("ALWAYS");
    expect(course.lessons[1]!.result!.reviewAccess).toBe(
      "HIDDEN_NOT_PASSED",
    );
    expect(course.final!.result!.reviewAccess).toBe("ALWAYS");

    const nullVerdict = gradesPage([
      gradeCourseRow({
        lessons: gradeCourseRow().lessons.map((lesson) =>
          lesson.result !== null
            ? { ...lesson, result: { ...lesson.result, isPassed: null } }
            : lesson,
        ),
      }),
    ]).courses[0]!;
    expect(nullVerdict.lessons[0]!.result!.isPassed).toBe(false);
    expect(nullVerdict.lessons[0]!.result!.reviewAccess).toBe("ALWAYS");
    expect(nullVerdict.lessons[1]!.result!.reviewAccess).toBe(
      "HIDDEN_NOT_PASSED",
    );
  });

  it("final: questionCount from settings, reviewHref always present, result null before a submit", () => {
    const course = gradesPage(
      [gradeCourseRow()],
      { finalAttempts: new Map() },
    ).courses[0]!;
    expect(course.final).toEqual({
      questionCount: 5,
      reviewHref: "/belajar/gizi-seimbang/final-quiz",
      result: null,
    });
    expect(course.finalScorePercent).toBe(68);
  });

  it("passes the weights through untouched", () => {
    const page = gradesPage([]);
    expect(page.weights).toEqual({ lessonPercent: 60, finalPercent: 40 });
    expect(page.courses).toEqual([]);
  });
});
