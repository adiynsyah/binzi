// Quiz tables (PRD §11.2 "QUIZ", behaviour per §6.3).
//
// One attempt per quiz is a server-side rule (§6.3 QZ-08/QZ-11, §11.4 no. 8);
// the schema supports it with the composite and partial unique indexes below.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { enrollments } from "./progress";

export const quizTypeEnum = pgEnum("quiz_type", ["LESSON", "FINAL"]);

export const explanationPolicyEnum = pgEnum("explanation_policy", [
  "ALWAYS",
  "ON_PASS_ONLY",
  "NEVER",
]);

// MVP question types per §6.3 QZ-03: single-answer multiple choice and
// true/false. The true/false value name is not spelled out in the PRD;
// interpretation listed for review.
export const questionTypeEnum = pgEnum("question_type", [
  "SINGLE_CHOICE",
  "TRUE_FALSE",
]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "IN_PROGRESS",
  "SUBMITTED",
  "EXPIRED",
]);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: quizTypeEnum("type").notNull(),
    title: text("title").notNull(),
    instructions: text("instructions"),
    // §11.2: CHECK (BETWEEN 1 AND 180).
    durationMinutes: integer("duration_minutes").notNull(),
    passingScorePercent: integer("passing_score_percent").default(70).notNull(),
    maxAttempts: integer("max_attempts").default(1).notNull(),
    cooldownMinutes: integer("cooldown_minutes").default(0).notNull(),
    questionsPerAttempt: integer("questions_per_attempt"),
    shuffleQuestions: boolean("shuffle_questions").default(true).notNull(),
    shuffleOptions: boolean("shuffle_options").default(true).notNull(),
    explanationPolicy: explanationPolicyEnum("explanation_policy")
      .default("ALWAYS")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "quizzes_duration_minutes_check",
      sql`${table.durationMinutes} between 1 and 180`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id),
    orderIndex: integer("order_index").notNull(),
    type: questionTypeEnum("type").default("SINGLE_CHOICE").notNull(),
    text: jsonb("text").notNull(),
    imageUrl: text("image_url"),
    // Nullable in the database so drafts can auto-save; the Q40 rules
    // (explanation present) are enforced server-side on final save, CSV
    // import, and publish (PRD §11.4 no. 12).
    explanation: jsonb("explanation"),
    points: integer("points").default(1).notNull(),
    topicTag: text("topic_tag"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("questions_quiz_order_idx").on(table.quizId, table.orderIndex),
  ],
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    text: text("text").notNull(),
    // Never serialized to the client before submit (PRD §11.2, §12).
    isCorrect: boolean("is_correct").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("question_options_question_idx").on(table.questionId)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    attemptNumber: integer("attempt_number").notNull(),
    status: attemptStatusEnum("status").default("IN_PROGRESS").notNull(),
    // Question order locked when the attempt starts.
    questionOrder: uuid("question_order").array().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    // Authoritative expiry, always computed server-side (PRD §11.4 no. 5).
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    score: integer("score"),
    maxScore: integer("max_score"),
    scorePercent: numeric("score_percent", { precision: 5, scale: 2 }),
    isPassed: boolean("is_passed"),
    // Admin recovery path (QZ-19): reset is recorded, never deleted.
    resetBy: text("reset_by").references(() => users.id),
    resetReason: text("reset_reason"),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    focusLostCount: integer("focus_lost_count").default(0).notNull(),
    ip: inet("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("quiz_attempts_quiz_user_number_unique").on(
      table.quizId,
      table.userId,
      table.attemptNumber,
    ),
    // PRD §11.2: one active attempt per user per quiz (QZ-08).
    uniqueIndex("one_active_attempt")
      .on(table.quizId, table.userId)
      .where(sql`${table.status} = 'IN_PROGRESS'`),
    // PRD §11.3: "Nilai Saya" lookup.
    index("quiz_attempts_user_quiz_idx").on(table.userId, table.quizId),
  ],
);

// Participant reports of a disrupted attempt (card S3-03, QZ-19 / CMS-10).
export const attemptReportCategoryEnum = pgEnum("attempt_report_category", [
  "SUBMIT_ERROR",
  "TIMER_ENDED_EARLY",
  "CONTENT_MISSING",
  "OTHER",
]);

export const attemptReportStatusEnum = pgEnum("attempt_report_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const quizAttemptReports = pgTable(
  "quiz_attempt_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Display number ("R-{number}"); never reused, never typed by anyone.
    number: integer("number").generatedAlwaysAsIdentity(),
    // One report per attempt (7i: "Satu laporan per attempt").
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id),
    // The reporter is always the attempt's owner (copied from the attempt).
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    category: attemptReportCategoryEnum("category").notNull(),
    description: text("description").notNull(),
    status: attemptReportStatusEnum("status").default("PENDING").notNull(),
    // Shown to the participant as-is.
    decisionReason: text("decision_reason"),
    // Staff only — never serialized to the participant.
    internalNote: text("internal_note"),
    decidedBy: text("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("quiz_attempt_reports_number_unique").on(table.number),
    unique("quiz_attempt_reports_attempt_unique").on(table.attemptId),
    // A decision always has a timestamp, and only a decision has one.
    check(
      "quiz_attempt_reports_decided_at_check",
      sql`(${table.status} = 'PENDING') = (${table.decidedAt} is null)`,
    ),
    // A decided report always carries the reason the participant reads.
    check(
      "quiz_attempt_reports_decision_reason_check",
      sql`${table.status} = 'PENDING' or ${table.decisionReason} is not null`,
    ),
    // Queue: per-status tabs ordered by created_at.
    index("quiz_attempt_reports_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    selectedOptionId: uuid("selected_option_id").references(
      () => questionOptions.id,
    ),
    isCorrect: boolean("is_correct"),
    pointsEarned: integer("points_earned").default(0).notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("quiz_answers_attempt_question_unique").on(
      table.attemptId,
      table.questionId,
    ),
  ],
);
