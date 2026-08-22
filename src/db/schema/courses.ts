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
import { courseDifficulty, publicationStatus } from "./enums";
import { lessons } from "./lessons";
import { quizzes } from "./quizzes";
import { enrollments } from "./learning";

/**
 * BINZI Course (Drizzle Spec §6).
 *
 * slug is globally UNIQUE (public /courses/[slug] resolution).
 * Publication consistency: PUBLISHED requires published_at
 * (one-directional CHECK — unpublishing does NOT clear published_at,
 * approved decision #18).
 */
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    difficulty: courseDifficulty("difficulty").notNull(),
    estimatedDuration: integer("estimated_duration"),
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
    unique("courses_slug_unique").on(t.slug),
    check(
      "courses_published_at_check",
      sql`${t.status} <> 'PUBLISHED' OR ${t.publishedAt} IS NOT NULL`,
    ),
    check(
      "courses_estimated_duration_check",
      sql`${t.estimatedDuration} IS NULL OR ${t.estimatedDuration} >= 0`,
    ),
  ],
);

export const coursesRelations = relations(courses, ({ one, many }) => ({
  lessons: many(lessons),
  enrollments: many(enrollments),
  // One-to-one via UNIQUE(quizzes.course_id).
  finalQuiz: one(quizzes, {
    fields: [courses.id],
    references: [quizzes.courseId],
  }),
}));

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
