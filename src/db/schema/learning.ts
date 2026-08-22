import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { enrollmentStatus, lessonProgressStatus } from "./enums";
import { users } from "./users";
import { courses } from "./courses";
import { lessons } from "./lessons";
import { quizzes } from "./quizzes";
import { questions } from "./questions";
import { questionOptions } from "./questions";

/**
 * BINZI learning domain: enrollments, lesson_progress, quiz_attempts,
 * quiz_answers (Drizzle Spec §14–§17).
 *
 * quiz_answers carries the ONLY approved CASCADE
 * (quiz_attempts → quiz_answers, approved decision #19): an answer is
 * meaningless without its attempt. Everything else RESTRICTs.
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id), // RESTRICT (default)
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id), // RESTRICT (default)
    status: enrollmentStatus("status").notNull().default("ACTIVE"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    // One enrollment per user per course (Business Rules §8).
    unique("enrollments_user_course_unique").on(t.userId, t.courseId),
    check(
      "enrollments_status_completed_at_check",
      sql`(${t.status} = 'ACTIVE' AND ${t.completedAt} IS NULL) OR (${t.status} = 'COMPLETED' AND ${t.completedAt} IS NOT NULL)`,
    ),
    // user_id lookups are served by the unique constraint's leftmost
    // column; course_id-only scans (CMS) need this one.
    index("enrollments_course_id_idx").on(t.courseId),
  ],
);

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  progress: many(lessonProgress),
}));

/**
 * Created lazily when a user actually starts a lesson — never
 * pre-created at enrollment (Decisions Log #12). Status only ever
 * advances IN_PROGRESS → COMPLETED; failed retries never downgrade a
 * completed lesson (Business Rules §13, approved decision #21).
 */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id), // RESTRICT (default)
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id), // RESTRICT (default)
    status: lessonProgressStatus("status").notNull().default("NOT_STARTED"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    unique("lesson_progress_enrollment_lesson_unique").on(
      t.enrollmentId,
      t.lessonId,
    ),
    check(
      "lesson_progress_completed_at_check",
      sql`(${t.status} = 'COMPLETED') = (${t.completedAt} IS NOT NULL)`,
    ),
    check(
      "lesson_progress_started_at_check",
      sql`${t.status} <> 'IN_PROGRESS' OR ${t.startedAt} IS NOT NULL`,
    ),
  ],
);

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [lessonProgress.enrollmentId],
    references: [enrollments.id],
  }),
  lesson: one(lessons, {
    fields: [lessonProgress.lessonId],
    references: [lessons.id],
  }),
}));

/**
 * Quiz attempt (Drizzle Spec §16, amended by Decisions Log #10).
 *
 * correct_answers + total_questions are the AUTHORITATIVE record.
 * score is a derived display value:
 *   round(100 * correct_answers / total_questions)  — approved #7
 * passed is derived by exact integer comparison, immune to rounding:
 *   correct_answers * 100 >= 80 * total_questions   — approved #8
 *
 * No UNIQUE on (user_id, quiz_id): unlimited attempts (V1).
 * kept user_id + quiz_id linkage — no enrollment_id (approved #23).
 */
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id), // RESTRICT (default)
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id), // RESTRICT (default)
    correctAnswers: integer("correct_answers").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    score: integer("score").notNull(),
    passed: boolean("passed").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "quiz_attempts_counts_check",
      sql`${t.totalQuestions} > 0 AND ${t.correctAnswers} >= 0 AND ${t.correctAnswers} <= ${t.totalQuestions}`,
    ),
    check(
      "quiz_attempts_score_range_check",
      sql`${t.score} >= 0 AND ${t.score} <= 100`,
    ),
    check(
      "quiz_attempts_score_derived_check",
      sql`${t.score} = CAST(round(100.0 * ${t.correctAnswers} / ${t.totalQuestions}) AS INTEGER)`,
    ),
    check(
      "quiz_attempts_passed_derived_check",
      sql`${t.passed} = (${t.correctAnswers} * 100 >= 80 * ${t.totalQuestions})`,
    ),
    // Attempt-history lookup path (Drizzle Spec §20).
    index("quiz_attempts_user_quiz_idx").on(t.userId, t.quizId),
  ],
);

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  answers: many(quizAnswers),
}));

/**
 * Historical answer snapshot (Drizzle Spec §17).
 *
 * is_correct is computed by the server at submission time and frozen —
 * never accepted from the client (approved decision #24), never
 * recomputed if question content changes later.
 */
export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }), // approved #19
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id), // RESTRICT (default)
    selectedOptionId: uuid("selected_option_id")
      .notNull()
      .references(() => questionOptions.id), // RESTRICT (default)
    isCorrect: boolean("is_correct").notNull(),
  },
  (t) => [
    // One answer per question per attempt.
    unique("quiz_answers_attempt_question_unique").on(t.attemptId, t.questionId),
  ],
);

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [quizAnswers.questionId],
    references: [questions.id],
  }),
  selectedOption: one(questionOptions, {
    fields: [quizAnswers.selectedOptionId],
    references: [questionOptions.id],
  }),
}));

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type NewLessonProgress = typeof lessonProgress.$inferInsert;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
export type QuizAnswer = typeof quizAnswers.$inferSelect;
export type NewQuizAnswer = typeof quizAnswers.$inferInsert;
