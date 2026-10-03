// Progress & scores (PRD §11.2 "PROGRESS & NILAI").
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, lessons } from "./course";

// Prepared for phase 2 monetization (PRD §11.1, K-02).
export const accessTypeEnum = pgEnum("access_type", ["FREE", "PAID"]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "IN_PROGRESS",
  "COMPLETED",
  "PASSED",
]);

// Values beyond the NOT_STARTED default are not enumerated in PRD §11.2;
// interpretation listed for review.
export const progressStatusEnum = pgEnum("progress_status", [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    accessType: accessTypeEnum("access_type").default("FREE").notNull(),
    status: enrollmentStatusEnum("status").default("IN_PROGRESS").notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    progressPercent: numeric("progress_percent", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    // (lesson quiz average × 60%) + (final quiz × 40%); weights live in
    // system_settings (score.lesson_weight / score.final_weight).
    finalScorePercent: numeric("final_score_percent", {
      precision: 5,
      scale: 2,
    }),
    lastLessonId: uuid("last_lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    totalSecondsSpent: integer("total_seconds_spent").default(0).notNull(),
    // Course resets bump this counter; quiz_attempts are never deleted
    // (PRD §11.4 no. 6).
    resetCount: integer("reset_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("enrollments_user_course_unique").on(table.userId, table.courseId),
    // PRD §11.3: "Kursus Saya" ordering.
    index("enrollments_user_updated_idx").on(
      table.userId,
      table.updatedAt.desc(),
    ),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    status: progressStatusEnum("status").default("NOT_STARTED").notNull(),
    videoWatchedPercent: numeric("video_watched_percent", {
      precision: 5,
      scale: 2,
    })
      .default("0")
      .notNull(),
    videoLastPositionSeconds: integer("video_last_position_seconds")
      .default(0)
      .notNull(),
    // Gate for the next lesson; enforced server-side (PRD §11.4 no. 7).
    quizAttempted: boolean("quiz_attempted").default(false).notNull(),
    // Single, final score for the lesson quiz.
    quizScorePercent: numeric("quiz_score_percent", { precision: 5, scale: 2 }),
    // Label only — passing never locks anything (PRD §6.3).
    quizIsPassed: boolean("quiz_is_passed"),
    quizSubmittedAt: timestamp("quiz_submitted_at", { withTimezone: true }),
    // Nullable: a row can exist in NOT_STARTED before the lesson is opened.
    firstAccessedAt: timestamp("first_accessed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // PRD §11.2 UNIQUE(user_id, lesson_id); the §11.3 index on
    // (user_id, lesson_id) is covered by this unique constraint.
    unique("lesson_progress_user_lesson_unique").on(
      table.userId,
      table.lessonId,
    ),
  ],
);
