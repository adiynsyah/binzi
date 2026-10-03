// Schema barrel (PRD §9.6): re-exports every table/enum and declares all
// Drizzle relations. Edges between the same pair of tables more than once
// (e.g. courses.createdBy/updatedBy/reviewer → users) carry an explicit
// relationName on both sides.
import { relations } from "drizzle-orm";

import { accounts, sessions, users } from "./auth";
import { courses, lessons, sections } from "./course";
import {
  questionOptions,
  questions,
  quizAnswers,
  quizAttempts,
  quizzes,
} from "./quiz";
import { enrollments, lessonProgress } from "./progress";
import { articleCategories, articleTags, articles, tags } from "./article";
import { mediaAssets } from "./media";
import { auditLogs, systemSettings } from "./system";

export * from "./auth";
export * from "./course";
export * from "./quiz";
export * from "./progress";
export * from "./article";
export * from "./media";
export * from "./system";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  enrollments: many(enrollments),
  lessonProgress: many(lessonProgress),
  quizAttempts: many(quizAttempts, { relationName: "attempt_user" }),
  resetAttempts: many(quizAttempts, { relationName: "attempt_reset_by" }),
  coursesCreated: many(courses, { relationName: "course_created_by" }),
  coursesUpdated: many(courses, { relationName: "course_updated_by" }),
  coursesReviewed: many(courses, { relationName: "course_reviewer" }),
  articlesAuthored: many(articles, { relationName: "article_author" }),
  articlesReviewed: many(articles, { relationName: "article_reviewer" }),
  mediaUploads: many(mediaAssets),
  auditLogs: many(auditLogs),
  updatedSettings: many(systemSettings),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  finalQuiz: one(quizzes, {
    fields: [courses.finalQuizId],
    references: [quizzes.id],
    relationName: "course_final_quiz",
  }),
  createdBy: one(users, {
    fields: [courses.createdBy],
    references: [users.id],
    relationName: "course_created_by",
  }),
  updatedBy: one(users, {
    fields: [courses.updatedBy],
    references: [users.id],
    relationName: "course_updated_by",
  }),
  reviewer: one(users, {
    fields: [courses.reviewerId],
    references: [users.id],
    relationName: "course_reviewer",
  }),
  sections: many(sections),
  lessons: many(lessons),
  enrollments: many(enrollments),
  relatedArticles: many(articles, { relationName: "article_related_course" }),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  course: one(courses, {
    fields: [sections.courseId],
    references: [courses.id],
  }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  section: one(sections, {
    fields: [lessons.sectionId],
    references: [sections.id],
  }),
  quiz: one(quizzes, {
    fields: [lessons.quizId],
    references: [quizzes.id],
    relationName: "lesson_quiz",
  }),
  progress: many(lessonProgress),
  lastLessonForEnrollments: many(enrollments, {
    relationName: "enrollment_last_lesson",
  }),
}));

export const quizzesRelations = relations(quizzes, ({ many }) => ({
  questions: many(questions),
  attempts: many(quizAttempts),
  finalForCourses: many(courses, { relationName: "course_final_quiz" }),
  lessons: many(lessons, { relationName: "lesson_quiz" }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [questions.quizId], references: [quizzes.id] }),
  options: many(questionOptions),
  answers: many(quizAnswers),
}));

export const questionOptionsRelations = relations(
  questionOptions,
  ({ one, many }) => ({
    question: one(questions, {
      fields: [questionOptions.questionId],
      references: [questions.id],
    }),
    answers: many(quizAnswers, { relationName: "answer_selected_option" }),
  }),
);

export const quizAttemptsRelations = relations(
  quizAttempts,
  ({ one, many }) => ({
    quiz: one(quizzes, {
      fields: [quizAttempts.quizId],
      references: [quizzes.id],
    }),
    user: one(users, {
      fields: [quizAttempts.userId],
      references: [users.id],
      relationName: "attempt_user",
    }),
    enrollment: one(enrollments, {
      fields: [quizAttempts.enrollmentId],
      references: [enrollments.id],
    }),
    resetBy: one(users, {
      fields: [quizAttempts.resetBy],
      references: [users.id],
      relationName: "attempt_reset_by",
    }),
    answers: many(quizAnswers),
  }),
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
    relationName: "answer_selected_option",
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  lastLesson: one(lessons, {
    fields: [enrollments.lastLessonId],
    references: [lessons.id],
    relationName: "enrollment_last_lesson",
  }),
  attempts: many(quizAttempts),
  lessonProgress: many(lessonProgress),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(lessons, {
    fields: [lessonProgress.lessonId],
    references: [lessons.id],
  }),
  enrollment: one(enrollments, {
    fields: [lessonProgress.enrollmentId],
    references: [enrollments.id],
  }),
}));

export const articleCategoriesRelations = relations(
  articleCategories,
  ({ many }) => ({
    articles: many(articles),
  }),
);

export const articlesRelations = relations(articles, ({ one, many }) => ({
  category: one(articleCategories, {
    fields: [articles.categoryId],
    references: [articleCategories.id],
  }),
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
    relationName: "article_author",
  }),
  reviewer: one(users, {
    fields: [articles.reviewerId],
    references: [users.id],
    relationName: "article_reviewer",
  }),
  relatedCourse: one(courses, {
    fields: [articles.relatedCourseId],
    references: [courses.id],
    relationName: "article_related_course",
  }),
  articleTags: many(articleTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  articleTags: many(articleTags),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, {
    fields: [articleTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, { fields: [articleTags.tagId], references: [tags.id] }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  uploadedBy: one(users, {
    fields: [mediaAssets.uploadedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updatedBy: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}));
