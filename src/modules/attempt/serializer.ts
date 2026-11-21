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

// --------------------------------------------------- S5-03 Nilai Saya DTO

/** One stored quiz result as the grades table shows it (card S5-03 §2).
 *  `scorePercent` is FLOORED (the S3-02 rule — the same number as the
 *  quiz's own result screen), and `reviewAccess` comes from the ONE
 *  policy derivation so the link's accessible name matches the page it
 *  opens. No ids, no answers, no key — the href is the quiz page's. */
export type GradeResultDTO = {
  scorePercent: number;
  isPassed: boolean;
  submittedAt: string | null;
  reviewHref: string;
  reviewAccess: QuizReviewAccess;
};

/** One lesson row of a course's grades table: "belum" is `result: null`
 *  (an unlocked, unattempted quiz — decision 4). */
export type GradeLessonRowDTO = {
  position: number;
  title: string;
  result: GradeResultDTO | null;
};

/** One course card of the grades page (card S5-03 §2). `final` carries
 *  `reviewHref` (the final-quiz page URL — the SAME href the "Kerjakan
 *  Final Quiz" link of `nextStep: "final"` needs, since an unattempted
 *  Final has no result to hang it on). */
export type GradeCourseDTO = {
  id: string;
  title: string;
  lessonCount: number;
  badge: "sedang-berjalan" | "selesai" | "lulus";
  meta: { kind: "selesai" | "terakhir-diakses"; at: string };
  finalScorePercent: number | null;
  lessonAveragePercent: number | null;
  lessons: GradeLessonRowDTO[];
  lockedCount: number;
  final: {
    questionCount: number;
    reviewHref: string;
    result: GradeResultDTO | null;
  } | null;
  nextStep: "materi" | "final" | null;
};

export type GradesPageDTO = {
  weights: FinalScoreWeightsDTO;
  courses: GradeCourseDTO[];
};

/**
 * The progress module's `GradeCourseContext` as it enters the serializer —
 * spelled out locally (the AttemptRow pattern: pure serializer, no import
 * from another module's files, so it stays runnable without a database).
 */
export type GradeCourseRow = {
  courseId: string;
  courseTitle: string;
  lessonCount: number;
  enrollmentStatus: "IN_PROGRESS" | "COMPLETED" | "PASSED";
  finalScorePercent: string | null;
  completedAt: Date | null;
  lastActivityAt: Date;
  finalQuizId: string | null;
  finalQuizHref: string | null;
  allLessonsCompleted: boolean;
  lessons: {
    position: number;
    title: string;
    quizId: string | null;
    quizHref: string | null;
    unlocked: boolean;
    result: {
      scorePercent: string;
      isPassed: boolean | null;
      submittedAt: Date | null;
    } | null;
  }[];
};

/** The grades page's quiz settings as the serializer reads them. */
export type GradeQuizSettingsInput = {
  explanationPolicy: ExplanationPolicy;
  questionCount: number;
};

/** One finished live Final attempt as the serializer reads it. */
export type GradeFinalAttemptInput = {
  scorePercent: string | null;
  isPassed: boolean | null;
  submittedAt: Date | null;
};

/** FK-guaranteed settings lookup — a miss is corrupt data, not a UX case
 *  (the S5-02 stance: fail loud, never render a grade without its policy). */
function mustGradeSettings(
  settings: ReadonlyMap<string, GradeQuizSettingsInput>,
  quizId: string,
): GradeQuizSettingsInput {
  const row = settings.get(quizId);
  if (row === undefined) {
    throw new Error("attempt serializer: quiz settings missing for a grade");
  }
  return row;
}

function toGradeResultDTO(
  raw: {
    scorePercent: string | null;
    isPassed: boolean | null;
    submittedAt: Date | null;
  },
  settings: GradeQuizSettingsInput,
  reviewHref: string,
): GradeResultDTO {
  const isPassed = raw.isPassed === true;
  return {
    // `?? 0` is the result screens' stance (toQuizReviewDTO): a finished
    // attempt always carries a score; null reads as 0, never as NaN.
    scorePercent: Math.floor(Number(raw.scorePercent ?? 0)),
    isPassed,
    submittedAt:
      raw.submittedAt === null ? null : raw.submittedAt.toISOString(),
    reviewHref,
    reviewAccess: reviewAccessOf(settings.explanationPolicy, isPassed),
  };
}

/**
 * The grades page's DTO (card S5-03 §2). One number, one source: lesson
 * results straight from lesson_progress (the Daftar materi numbers), the
 * Final result from the live finished attempt (the Final result screen's
 * number), Nilai Akhir + badge from the STORED enrollment (never
 * recomputed — 19 Nov no. 2). A course without a single result drops out
 * (decision 3 → the 8f empty state); `finalScorePercent` and `nextStep`
 * exist only while/before IN_PROGRESS per the same rule.
 */
export function toGradesPageDTO(input: {
  courses: readonly GradeCourseRow[];
  settings: ReadonlyMap<string, GradeQuizSettingsInput>;
  finalAttempts: ReadonlyMap<string, GradeFinalAttemptInput>;
  weights: FinalScoreWeightsDTO;
}): GradesPageDTO {
  const courses: GradeCourseDTO[] = [];
  for (const course of input.courses) {
    const inProgress = course.enrollmentStatus === "IN_PROGRESS";
    const finalSettings =
      course.finalQuizId !== null
        ? mustGradeSettings(input.settings, course.finalQuizId)
        : undefined;
    const finalAttempt =
      course.finalQuizId !== null
        ? input.finalAttempts.get(course.finalQuizId)
        : undefined;
    const final =
      finalSettings !== undefined &&
      course.finalQuizId !== null &&
      course.finalQuizHref !== null
        ? {
            questionCount: finalSettings.questionCount,
            reviewHref: course.finalQuizHref,
            result:
              finalAttempt !== undefined
                ? toGradeResultDTO(
                    finalAttempt,
                    finalSettings,
                    course.finalQuizHref,
                  )
                : null,
          }
        : null;

    const lessons: GradeLessonRowDTO[] = [];
    let lockedCount = 0;
    const lessonScores: number[] = [];
    for (const row of course.lessons) {
      if (row.result !== null) {
        // A stored result implies the quiz (and its href) exists — an
        // attempted quiz always has both.
        if (row.quizId === null || row.quizHref === null) {
          throw new Error("attempt serializer: grade result without a quiz");
        }
        lessons.push({
          position: row.position,
          title: row.title,
          result: toGradeResultDTO(
            row.result,
            mustGradeSettings(input.settings, row.quizId),
            row.quizHref,
          ),
        });
        lessonScores.push(Number(row.result.scorePercent));
      } else if (row.unlocked) {
        lessons.push({ position: row.position, title: row.title, result: null });
      } else {
        lockedCount += 1;
      }
    }

    // Decision 3: no result anywhere → the course is not a grade yet.
    if (lessonScores.length === 0 && final?.result == null) continue;

    const lessonAveragePercent =
      lessonScores.length > 0
        ? Math.round(
            lessonScores.reduce((total, score) => total + score, 0) /
              lessonScores.length,
          )
        : null;

    courses.push({
      id: course.courseId,
      title: course.courseTitle,
      lessonCount: course.lessonCount,
      badge:
        course.enrollmentStatus === "PASSED"
          ? "lulus"
          : course.enrollmentStatus === "COMPLETED"
            ? "selesai"
            : "sedang-berjalan",
      meta: inProgress
        ? {
            kind: "terakhir-diakses",
            at: course.lastActivityAt.toISOString(),
          }
        : {
            kind: "selesai",
            at: (course.completedAt ?? course.lastActivityAt).toISOString(),
          },
      finalScorePercent:
        !inProgress && course.finalScorePercent !== null
          ? Math.round(Number(course.finalScorePercent))
          : null,
      lessonAveragePercent,
      lessons,
      lockedCount,
      final,
      nextStep: inProgress
        ? course.allLessonsCompleted
          ? ("final" as const)
          : ("materi" as const)
        : null,
    });
  }
  return { weights: input.weights, courses };
}
