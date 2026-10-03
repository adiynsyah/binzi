// Course tables (PRD §11.2 "KURSUS").
//
// There is intentionally no course_categories table and no courses.category_id
// column: categories are article-only (PRD §11.1, K-14).
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { quizzes } from "./quiz";

// Values are not enumerated in PRD §11.2; interpretation listed for review.
export const courseLevelEnum = pgEnum("course_level", [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
]);

// CMS workflow states (CMS-05: DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED).
export const contentStatusEnum = pgEnum("content_status", [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
]);

export const videoStatusEnum = pgEnum("video_status", [
  "NONE",
  "UPLOADING",
  "READY",
  "FAILED",
]);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    summary: text("summary"),
    description: jsonb("description"),
    thumbnailUrl: text("thumbnail_url"),
    level: courseLevelEnum("level").notNull(),
    estimatedMinutes: integer("estimated_minutes"),
    isSequential: boolean("is_sequential").default(true).notNull(),
    status: contentStatusEnum("status").default("DRAFT").notNull(),
    // PRD §11.4 no. 3: UNIQUE — one final quiz per course.
    finalQuizId: uuid("final_quiz_id")
      .unique()
      .references(() => quizzes.id),
    reviewerId: text("reviewer_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    enrollmentCount: integer("enrollment_count").default(0).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // PRD §11.3: listing lookup for published courses only.
    index("courses_published_idx")
      .on(table.status, table.publishedAt.desc())
      .where(sql`${table.status} = 'PUBLISHED'`),
  ],
);

// Ready for use but hidden in the MVP UI (PRD §11.1).
export const sections = pgTable("sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  title: text("title").notNull(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    sectionId: uuid("section_id").references(() => sections.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    orderIndex: integer("order_index").notNull(),
    content: jsonb("content").notNull(), // TipTap document
    // Object key in R2, never a (temporary) presigned URL (PRD §11.1).
    videoKey: text("video_key"),
    videoStatus: videoStatusEnum("video_status").default("NONE").notNull(),
    videoDurationSeconds: integer("video_duration_seconds"),
    videoSizeBytes: bigint("video_size_bytes", { mode: "number" }),
    // PRD §11.4 no. 3: UNIQUE — one quiz per lesson.
    quizId: uuid("quiz_id")
      .unique()
      .references(() => quizzes.id),
    isFreePreview: boolean("is_free_preview").default(false).notNull(),
    estimatedMinutes: integer("estimated_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("lessons_course_slug_unique").on(table.courseId, table.slug),
    // PRD §11.3: ordered material listing per course.
    index("lessons_course_order_idx").on(table.courseId, table.orderIndex),
  ],
);
