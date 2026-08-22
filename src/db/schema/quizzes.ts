import { relations, sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { quizType } from "./enums";
import { lessons } from "./lessons";
import { courses } from "./courses";
import { questions } from "./questions";
import { quizAttempts } from "./learning";

/**
 * BINZI Quiz + Quiz Question assignment (Drizzle Spec §10, §13).
 *
 * Quiz shape is enforced by the database:
 *   - type LESSON → lesson_id set, course_id NULL
 *   - type FINAL  → course_id set, lesson_id NULL
 *   - UNIQUE(lesson_id) → one Lesson Quiz per Lesson
 *   - UNIQUE(course_id) → one Final Quiz per Course
 *
 * Quizzes carry NO publication status (approved decision #17) — quiz
 * readiness (Lesson = exactly 10, Final = 10–30 questions) is course
 * publish validation, a service-layer rule.
 *
 * quiz_questions is the reusable-question join with explicit ordering:
 *   UNIQUE(quiz_id, question_id) — no duplicate use within one quiz
 *   UNIQUE(quiz_id, sort_order)  — explicit question order
 */
export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    type: quizType("type").notNull(),
    lessonId: uuid("lesson_id").references(() => lessons.id), // RESTRICT
    courseId: uuid("course_id").references(() => courses.id), // RESTRICT
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("quizzes_lesson_id_unique").on(t.lessonId),
    unique("quizzes_course_id_unique").on(t.courseId),
    check(
      "quizzes_type_ownership_check",
      sql`(${t.type} = 'LESSON' AND ${t.lessonId} IS NOT NULL AND ${t.courseId} IS NULL) OR (${t.type} = 'FINAL' AND ${t.courseId} IS NOT NULL AND ${t.lessonId} IS NULL)`,
    ),
  ],
);

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  lesson: one(lessons, {
    fields: [quizzes.lessonId],
    references: [lessons.id],
  }),
  course: one(courses, {
    fields: [quizzes.courseId],
    references: [courses.id],
  }),
  quizQuestions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id), // RESTRICT (default)
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id), // RESTRICT (default)
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    unique("quiz_questions_quiz_question_unique").on(t.quizId, t.questionId),
    unique("quiz_questions_quiz_sort_order_unique").on(t.quizId, t.sortOrder),
    check("quiz_questions_sort_order_check", sql`${t.sortOrder} > 0`),
  ],
);

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
  question: one(questions, {
    fields: [quizQuestions.questionId],
    references: [questions.id],
  }),
}));

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;
