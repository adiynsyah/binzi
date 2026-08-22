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
import { publicationStatus } from "./enums";
import { courses } from "./courses";
import { contents } from "./contents";
import { quizzes } from "./quizzes";
import { lessonProgress } from "./learning";

/**
 * BINZI Lesson + Lesson Content assignment (Drizzle Spec §7, §9).
 *
 * Lessons are ordered within their Course:
 *   UNIQUE(course_id, sort_order), UNIQUE(course_id, slug).
 *
 * lesson_contents carries UNIQUE(content_id): one Content belongs to
 * at most one Lesson in V1 (approved decision #3). A draft-lesson
 * deletion removes lesson_contents rows explicitly in a transaction —
 * no CASCADE (approved decision #20).
 */
export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id), // RESTRICT (default)
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
    status: publicationStatus("status").notNull().default("DRAFT"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    unique("lessons_course_slug_unique").on(t.courseId, t.slug),
    unique("lessons_course_sort_order_unique").on(t.courseId, t.sortOrder),
    check("lessons_sort_order_check", sql`${t.sortOrder} > 0`),
    check(
      "lessons_published_at_check",
      sql`${t.status} <> 'PUBLISHED' OR ${t.publishedAt} IS NOT NULL`,
    ),
  ],
);

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  lessonContents: many(lessonContents),
  // One-to-one via UNIQUE(quizzes.lesson_id).
  lessonQuiz: one(quizzes, {
    fields: [lessons.id],
    references: [quizzes.lessonId],
  }),
  progress: many(lessonProgress),
}));

export const lessonContents = pgTable(
  "lesson_contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id), // RESTRICT (default)
    contentId: uuid("content_id")
      .notNull()
      .references(() => contents.id), // RESTRICT (default)
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Intentional: one Content belongs to at most one Lesson (V1).
    unique("lesson_contents_content_id_unique").on(t.contentId),
    unique("lesson_contents_lesson_sort_order_unique").on(
      t.lessonId,
      t.sortOrder,
    ),
    check("lesson_contents_sort_order_check", sql`${t.sortOrder} > 0`),
  ],
);

export const lessonContentsRelations = relations(lessonContents, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonContents.lessonId],
    references: [lessons.id],
  }),
  content: one(contents, {
    fields: [lessonContents.contentId],
    references: [contents.id],
  }),
}));

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type LessonContent = typeof lessonContents.$inferSelect;
export type NewLessonContent = typeof lessonContents.$inferInsert;
