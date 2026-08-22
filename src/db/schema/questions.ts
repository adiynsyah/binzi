import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { quizQuestions } from "./quizzes";

/**
 * BINZI Question + Question Option (Drizzle Spec §11, §12).
 *
 * Questions are a reusable bank — NO publication status (approved
 * decision #17). "Exactly one correct option per published question"
 * is service-layer publish validation (Business Rules §15); the
 * is_correct default FALSE guarantees new options are never
 * accidentally correct.
 *
 * Options belong to exactly one question — option reuse is not
 * modeled anywhere.
 */
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionText: text("question_text").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const questionsRelations = relations(questions, ({ many }) => ({
  options: many(questionOptions),
  quizQuestions: many(quizQuestions),
}));

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id), // RESTRICT (default)
    optionText: text("option_text").notNull(),
    sortOrder: integer("sort_order").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
  },
  (t) => [
    unique("question_options_question_sort_order_unique").on(
      t.questionId,
      t.sortOrder,
    ),
    check("question_options_sort_order_check", sql`${t.sortOrder} > 0`),
  ],
);

export const questionOptionsRelations = relations(
  questionOptions,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionOptions.questionId],
      references: [questions.id],
    }),
  }),
);

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type NewQuestionOption = typeof questionOptions.$inferInsert;
