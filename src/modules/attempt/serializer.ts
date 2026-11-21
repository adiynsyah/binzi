// Explicit serialization for the attempt module (card S3-01 §1; PRD §12.6
// V-01 — `is_correct`/`explanation` never leave the server before submit).
//
// Pure on purpose: only type-only imports from the db schema plus
// docToPlainText (pure lib) — no runtime db import, so serializer.test.ts
// runs without a database. Every builder constructs fresh objects from an
// explicit allowlist, so a column not listed (is_correct on options, points,
// reset columns…) can never ride along even if a query starts selecting it.
import { docToPlainText } from "@/lib/content-doc";

export type QuizQuestionType = "SINGLE_CHOICE" | "TRUE_FALSE";
export type ExplanationPolicy = "ALWAYS" | "ON_PASS_ONLY" | "NEVER";
export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
export type QuizType = "LESSON" | "FINAL";

/** The quizzes row's settings columns the attempt flow reads (queries.ts). */
export type QuizSettingsRow = {
  id: string;
  type: QuizType;
  title: string;
  durationMinutes: number;
  passingScorePercent: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  explanationPolicy: ExplanationPolicy;
};

/** One questions row (queries.ts). `text`/`explanation` are TipTap jsonb. */
export type AttemptQuestionRow = {
  id: string;
  orderIndex: number;
  type: QuizQuestionType;
  text: unknown;
  explanation: unknown;
  points: number;
};

/** One question_options row (queries.ts) — isCorrect NEVER leaves as-is. */
export type AttemptOptionRow = {
  questionId: string;
  id: string;
  orderIndex: number;
  text: string;
  isCorrect: boolean;
};

/** The quiz_attempts columns the page states read (queries.ts). */
export type AttemptRow = {
  id: string;
  quizId: string;
  userId: string;
  enrollmentId: string;
  status: AttemptStatus;
  questionOrder: string[];
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  /** NUMERIC arrives as a string — Number()'d by the builders. */
  scorePercent: string | null;
  isPassed: boolean | null;
};

/** One quiz_answers row (queries.ts). */
export type AttemptAnswerRow = {
  questionId: string;
  selectedOptionId: string | null;
};

// --------------------------------------------------------------- option order

/** FNV-1a over the seed string → unsigned 32-bit (hand-written, no crypto). */
function fnv1a(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — small, well-known deterministic PRNG (hand-written). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

/**
 * The ONE option orderer (owner decision 8): deterministic Fisher–Yates
 * seeded from `"${attemptId}:${questionId}"`, so the running screen and the
 * result screen show the SAME order with no extra column. True/False is
 * never shuffled; labels are assigned AFTER the sort. The returned objects
 * carry id/label/text only — isCorrect is dropped right here.
 */
export function orderOptions<T extends { id: string; text: string }>(
  options: readonly T[],
  config: {
    attemptId: string;
    questionId: string;
    type: QuizQuestionType;
    shuffle: boolean;
  },
): { id: string; label: string; text: string }[] {
  const ordered = [...options];
  if (config.shuffle && config.type !== "TRUE_FALSE") {
    const rand = mulberry32(
      fnv1a(`${config.attemptId}:${config.questionId}`),
    );
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const swap = ordered[j]!;
      ordered[j] = ordered[i]!;
      ordered[i] = swap;
    }
  }
  return ordered.map((option, index) => ({
    id: option.id,
    label: OPTION_LABELS[index] ?? String(index + 1),
    text: option.text,
  }));
}

// ------------------------------------------------------------- the DTO union

export type QuizOptionDTO = { id: string; label: string; text: string };

/** The running question (state "berjalan") — no grading fields, ever. */
export type QuizRunningQuestionDTO = {
  id: string;
  number: number;
  text: string;
  type: QuizQuestionType;
  options: QuizOptionDTO[];
};

export type QuizRulesDTO = {
  state: "aturan";
  lessonId: string;
  quizTitle: string;
  lessonPosition: number;
  lessonTitle: string;
  questionCount: number;
  durationMinutes: number;
  passingScorePercent: number;
  explanationPolicy: ExplanationPolicy;
  /** Owner addendum: "pilihan ganda" in rule 01 only when every question is. */
  allSingleChoice: boolean;
  /** lessonHref() of the progress module — built by the service, not here. */
  lessonHref: string;
};

export type QuizRunningDTO = {
  state: "berjalan";
  /** Card S3-02 §1e: the eyebrow-styled h1 above the runner card —
   *  "Quiz Materi {posisi} · {judul materi}" (lesson) or "Final Quiz ·
   *  {judul kursus}" (Final). Built by the service from its context; it
   *  carries no grading data, so it joins the recursive key-scan safely. */
  heading: string;
  attemptId: string;
  expiresAt: string;
  serverNow: string;
  questions: QuizRunningQuestionDTO[];
  answers: Record<string, string>;
};

export type QuizResultItemDTO = {
  number: number;
  text: string;
  type: QuizQuestionType;
  options: {
    label: string;
    text: string;
    selected: boolean;
    /** null when the explanation policy hides the key. */
    correct: boolean | null;
  }[];
  explanation: string | null;
};

export type QuizResultDTO = {
  state: "hasil";
  reviewAccess: QuizReviewAccess;
  status: AttemptStatus;
  scorePercent: number;
  isPassed: boolean;
  correct: number;
  wrong: number;
  unanswered: number;
  durationSeconds: number;
  items: QuizResultItemDTO[];
  lesson: { position: number; title: string; href: string };
  next: { position: number; href: string } | null;
  /** Card S5-02 §5: non-null exactly when every lesson is COMPLETED and the
   *  course has a Final Quiz — the closing swaps "materi berikutnya" for
   *  "Lanjut ke Final Quiz". REQUIRED on the input too, so a caller that
   *  forgets it is a typecheck error, not a silent missing link. */
  finalQuizHref: string | null;
  /** Card S3-02 §5: the Final Quiz was already worked — finalQuizHref's
   *  gate plus the STORED enrollment status having left IN_PROGRESS (the
   *  "nilai tersimpan" lesson, 19 Nov no. 2: status is the source of
   *  truth, never a recompute from attempts). REQUIRED on the input too,
   *  same stance as finalQuizHref. */
  finalQuizDone: boolean;
};

/**
 * The quiz page DTO (card §1): one member per state. `kembali` hands the
 * href to redirect() with; `kedaluwarsa` carries just the attemptId the
 * beacon component submits.
 */
export type LessonQuizPageDTO =
  | { state: "kembali"; href: string }
  | QuizRulesDTO
  | QuizRunningDTO
  | { state: "kedaluwarsa"; attemptId: string }
  | QuizResultDTO;

// -------------------------------------------------- S5-02 final quiz states

/** The score split as the Final screens show it (PRG-05, from
 *  system_settings via the quiz module's service — plain numbers here). */
export type FinalScoreWeightsDTO = {
  lessonPercent: number;
  finalPercent: number;
};

/** The Final rules screen (card S5-02 §4.A, 7h left panel). */
export type FinalQuizRulesDTO = {
  state: "aturan-final";
  courseId: string;
  courseTitle: string;
  questionCount: number;
  durationMinutes: number;
  passingScorePercent: number;
  /** Rounded average of the lesson quiz scores; null is unreachable under
   *  the gate (rendered "–" defensively). */
  lessonAveragePercent: number | null;
  weights: FinalScoreWeightsDTO;
  /** "Ulas materi dulu" — the LAST lesson of the course. */
  lastLessonHref: string;
};

/** The Final result screen's course half (card S5-02 §4.D, 7h right) — the
 *  review half is the SAME QuizReviewDTO the lesson result shows. */
export type FinalQuizResultDTO = QuizReviewDTO & {
  state: "hasil-final";
  final: {
    durationLimitSeconds: number;
    passingScorePercent: number;
    /** Re-read from lesson_progress at view time, rounded. */
    lessonAveragePercent: number | null;
    weights: FinalScoreWeightsDTO;
    /** The STORED Nilai Akhir from enrollments, rounded for display. */
    finalScorePercent: number | null;
    courseStatus: "COMPLETED" | "PASSED";
  };
};

/**
 * The Final Quiz page DTO (card S5-02 §2): the same state machine as the
 * lesson quiz page — `kembali` (not enrolled / gate unmet without an
 * attempt), `aturan-final` (QZ-18 confirmation), `berjalan` (QuizRunner
 * as-is), `kedaluwarsa` (beacon), `hasil-final`.
 */
export type FinalQuizPageDTO =
  | { state: "kembali"; href: string }
  | FinalQuizRulesDTO
  | QuizRunningDTO
  | { state: "kedaluwarsa"; attemptId: string }
  | FinalQuizResultDTO;

// ------------------------------------------------------------------ builders

/** Options of one question, in storage order (queries.ts order). */
function optionsOf(
  optionRows: readonly AttemptOptionRow[],
  questionId: string,
): AttemptOptionRow[] {
  return optionRows.filter((option) => option.questionId === questionId);
}

/** Questions re-ordered to the attempt's locked question_order. */
export function questionsInAttemptOrder(
  questionRows: readonly AttemptQuestionRow[],
  questionOrder: readonly string[],
): AttemptQuestionRow[] {
  const byId = new Map(questionRows.map((row) => [row.id, row]));
  return questionOrder
    .map((id) => byId.get(id))
    .filter((row): row is AttemptQuestionRow => row !== undefined);
}

/** The rules screen's data (card §1 "aturan"; 7e). */
export function toQuizRulesDTO(input: {
  lessonId: string;
  lessonPosition: number;
  lessonTitle: string;
  settings: QuizSettingsRow;
  questionRows: readonly AttemptQuestionRow[];
  lessonHref: string;
}): QuizRulesDTO {
  return {
    state: "aturan",
    lessonId: input.lessonId,
    quizTitle: input.settings.title,
    lessonPosition: input.lessonPosition,
    lessonTitle: input.lessonTitle,
    questionCount: input.questionRows.length,
    durationMinutes: input.settings.durationMinutes,
    passingScorePercent: input.settings.passingScorePercent,
    explanationPolicy: input.settings.explanationPolicy,
    allSingleChoice: input.questionRows.every(
      (question) => question.type === "SINGLE_CHOICE",
    ),
    lessonHref: input.lessonHref,
  };
}

/**
 * The running screen's data (card §1 "berjalan"). The option mapper drops
 * isCorrect at the source; the whole DTO is key-scanned by the test.
 */
export function toQuizRunningDTO(input: {
  heading: string;
  attemptId: string;
  questionOrder: readonly string[];
  expiresAt: Date;
  serverNow: Date;
  settings: Pick<QuizSettingsRow, "shuffleOptions">;
  questionRows: readonly AttemptQuestionRow[];
  optionRows: readonly AttemptOptionRow[];
  answerRows: readonly AttemptAnswerRow[];
}): QuizRunningDTO {
  const ordered = questionsInAttemptOrder(
    input.questionRows,
    input.questionOrder,
  );
  const questions: QuizRunningQuestionDTO[] = ordered.map((question, index) => ({
    id: question.id,
    number: index + 1,
    text: docToPlainText(question.text),
    type: question.type,
    options: orderOptions(optionsOf(input.optionRows, question.id), {
      attemptId: input.attemptId,
      questionId: question.id,
      type: question.type,
      shuffle: input.settings.shuffleOptions,
    }),
  }));
  const answers: Record<string, string> = {};
  for (const answer of input.answerRows) {
    if (answer.selectedOptionId !== null) {
      answers[answer.questionId] = answer.selectedOptionId;
    }
  }
  return {
    state: "berjalan",
    heading: input.heading,
    attemptId: input.attemptId,
    expiresAt: input.expiresAt.toISOString(),
    serverNow: input.serverNow.toISOString(),
    questions,
    answers,
  };
}

/**
 * The review half BOTH result screens share (card S5-02 §2): score, verdict,
 * the three counters, the capped duration, and the per-item review — the
 * key (option.correct) and the explanation follow explanation_policy
 * together, hidden policy answers null for BOTH, so "Kunci:" can never
 * outlive the explanation.
 */
/**
 * Card S3-02 §3: which of the four review states the screen renders.
 * ALWAYS/PASSED → the full review (key + explanation); HIDDEN_NEVER/
 * HIDDEN_NOT_PASSED → the participant's own answers only, each hidden
 * state carrying its own intro sentence. "PASSED" is ON_PASS_ONLY for a
 * passing attempt — shown BECAUSE it passed, never "apa pun nilainya".
 */
export type QuizReviewAccess =
  | "ALWAYS"
  | "PASSED"
  | "HIDDEN_NEVER"
  | "HIDDEN_NOT_PASSED";

/**
 * The ONE policy→state derivation (card S3-02 §3; card S5-03 §2 lifts it
 * out of toQuizReviewDTO so the grades page can name the SAME review state
 * without a second copy): ALWAYS reveals, NEVER hides, ON_PASS_ONLY
 * reveals exactly for a passing attempt. `isPassed` is the STORED verdict
 * (`attempt.isPassed === true`), never a recompute from the score.
 */
export function reviewAccessOf(
  policy: ExplanationPolicy,
  isPassed: boolean,
): QuizReviewAccess {
  if (policy === "ALWAYS") return "ALWAYS";
  if (policy === "NEVER") return "HIDDEN_NEVER";
  return isPassed ? "PASSED" : "HIDDEN_NOT_PASSED";
}

export type QuizReviewDTO = {
  reviewAccess: QuizReviewAccess;
  status: AttemptStatus;
  scorePercent: number;
  isPassed: boolean;
  correct: number;
  wrong: number;
  unanswered: number;
  durationSeconds: number;
  items: QuizResultItemDTO[];
};

export function toQuizReviewDTO(input: {
  attempt: AttemptRow;
  settings: Pick<
    QuizSettingsRow,
    "shuffleOptions" | "explanationPolicy"
  >;
  questionRows: readonly AttemptQuestionRow[];
  optionRows: readonly AttemptOptionRow[];
  answerRows: readonly AttemptAnswerRow[];
}): QuizReviewDTO {
  const { attempt } = input;
  const ordered = questionsInAttemptOrder(
    input.questionRows,
    attempt.questionOrder,
  );
  const answerByQuestion = new Map(
    input.answerRows.map((row) => [row.questionId, row]),
  );
  // The key and the explanation live behind ONE policy gate (PRD §6.3):
  // ON_PASS_ONLY reveals both only for a passing attempt, NEVER hides
  // neither — so "Kunci:" can never outlive the explanation it belongs to.
  // reviewAccess (card S3-02 §3) names the state so BOTH result screens
  // pick their copy from one value instead of re-deriving the policy.
  const reviewAccess = reviewAccessOf(
    input.settings.explanationPolicy,
    attempt.isPassed === true,
  );
  const revealsKey = reviewAccess === "ALWAYS" || reviewAccess === "PASSED";

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  const items: QuizResultItemDTO[] = ordered.map((question, index) => {
    const options = optionsOf(input.optionRows, question.id);
    const answer = answerByQuestion.get(question.id);
    const selected = answer?.selectedOptionId ?? null;
    // Unanswered counts as wrong at grading time (submit service); here the
    // three counters are derived from the SAME rows so the screen's
    // "{a} benar · {b} salah · {c} tidak dijawab" always adds up.
    if (selected === null) {
      unanswered += 1;
    } else if (options.some((o) => o.id === selected && o.isCorrect)) {
      correct += 1;
    } else {
      wrong += 1;
    }
    return {
      number: index + 1,
      text: docToPlainText(question.text),
      type: question.type,
      options: orderOptions(options, {
        attemptId: attempt.id,
        questionId: question.id,
        type: question.type,
        shuffle: input.settings.shuffleOptions,
      }).map((option) => ({
        label: option.label,
        text: option.text,
        selected: option.id === selected,
        correct: revealsKey
          ? options.some((o) => o.id === option.id && o.isCorrect)
          : null,
      })),
      explanation:
        revealsKey && question.explanation !== null
          ? docToPlainText(question.explanation)
          : null,
    };
  });

  // EXPIRED attempts finalize at expires_at even when the submit landed in
  // the tolerance window after it — the timer never grants extra time.
  const endedAt =
    attempt.submittedAt !== null &&
    attempt.submittedAt.getTime() < attempt.expiresAt.getTime()
      ? attempt.submittedAt
      : attempt.expiresAt;
  const durationSeconds = Math.max(
    0,
    Math.floor(
      (endedAt.getTime() - attempt.startedAt.getTime()) / 1000,
    ),
  );

  return {
    reviewAccess,
    status: attempt.status,
    // Floor, never round up (card S3-02 §3): a 69.95 % attempt must not
    // read as 70 next to a "lulus di ≥ 70" verdict.
    scorePercent: Math.floor(Number(attempt.scorePercent ?? 0)),
    isPassed: attempt.isPassed === true,
    correct,
    wrong,
    unanswered,
    durationSeconds,
    items,
  };
}

/**
 * The lesson result screen's data (card §4.C): the shared review plus the
 * lesson pointer, the next-lesson pointer, and the Final Quiz closing href.
 */
export function toQuizResultDTO(input: {
  attempt: AttemptRow;
  settings: Pick<
    QuizSettingsRow,
    "shuffleOptions" | "explanationPolicy"
  >;
  questionRows: readonly AttemptQuestionRow[];
  optionRows: readonly AttemptOptionRow[];
  answerRows: readonly AttemptAnswerRow[];
  lesson: { position: number; title: string; href: string };
  next: { position: number; href: string } | null;
  finalQuizHref: string | null;
  finalQuizDone: boolean;
}): QuizResultDTO {
  const review = toQuizReviewDTO(input);
  return {
    state: "hasil",
    ...review,
    lesson: input.lesson,
    next: input.next,
    finalQuizHref: input.finalQuizHref,
    finalQuizDone: input.finalQuizDone,
  };
}

/**
 * The Final result screen's data (card S5-02 §4.D): the SAME review half the
 * lesson result shows, plus the course card (Nilai Akhir formula, stored
 * score, course status).
 */
export function toFinalQuizResultDTO(input: {
  attempt: AttemptRow;
  settings: Pick<
    QuizSettingsRow,
    "shuffleOptions" | "explanationPolicy"
  >;
  questionRows: readonly AttemptQuestionRow[];
  optionRows: readonly AttemptOptionRow[];
  answerRows: readonly AttemptAnswerRow[];
  final: FinalQuizResultDTO["final"];
}): FinalQuizResultDTO {
  const review = toQuizReviewDTO(input);
  return {
    state: "hasil-final",
    ...review,
    final: input.final,
  };
}
