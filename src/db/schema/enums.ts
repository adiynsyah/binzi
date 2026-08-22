import { pgEnum } from "drizzle-orm/pg-core";

/**
 * BINZI PostgreSQL enums (Drizzle Spec §3).
 *
 * Names and values are fixed by the approved schema design (TASK 006).
 * lesson_progress_status keeps NOT_STARTED for spec fidelity even though
 * rows are created directly as IN_PROGRESS (Decisions Log #12).
 */
export const userRole = pgEnum("user_role", ["USER", "ADMIN"]);

export const courseDifficulty = pgEnum("course_difficulty", [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
]);

// Reused by Course, Lesson, and Content (Drizzle Spec §3).
export const publicationStatus = pgEnum("publication_status", [
  "DRAFT",
  "PUBLISHED",
]);

export const contentType = pgEnum("content_type", [
  "ARTICLE",
  "VIDEO",
  "INFOGRAPHIC",
  "TEXT",
  "TIP",
]);

export const quizType = pgEnum("quiz_type", ["LESSON", "FINAL"]);

export const enrollmentStatus = pgEnum("enrollment_status", [
  "ACTIVE",
  "COMPLETED",
]);

export const lessonProgressStatus = pgEnum("lesson_progress_status", [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
]);
