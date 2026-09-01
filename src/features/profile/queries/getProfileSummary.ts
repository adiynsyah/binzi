import { and, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { courses, enrollments, lessonProgress, lessons, users } from "@/db/schema";

/**
 * Profile summary retrieval (BR §7.2 "View own profile", UI/UX §32
 * "Profile — V1 Profile can remain minimal: Name / Email, Courses,
 * Completed Courses, Current Learning").
 *
 * One server-side call backing the /profile page:
 * - Identity comes from the authoritative `public.users` record
 *   (Drizzle Spec §5; Decisions Log #22 — `users.id` equals the
 *   Supabase Auth user id). `user` is null when the application row
 *   is missing (an integrity anomaly the page handles by falling
 *   back to the session identity).
 * - The learning summary mirrors the TASK 043 derivation contract:
 *   the course set is PUBLISHED-only (drafts are indistinguishable
 *   and never listed — the same boundary as getCourseProgress), the
 *   lesson denominator is the PUBLISHED lesson set (BR §38), and
 *   the completed numerator counts only lesson_progress rows that
 *   reference lessons inside that set. Percent is computed, never
 *   stored (Blueprint §33): round(100 * completed / total), 0 when
 *   the course has no published lessons.
 *
 * Scope discipline: `userId` is always the server-derived session id
 * supplied by the page — this query never reads identity from client
 * input. UNIQUE(user_id, course_id) on enrollments and
 * UNIQUE(enrollment_id, lesson_id) on lesson_progress keep both
 * counts fan-out-free.
 */

export type ProfileEnrollment = {
  course: { slug: string; title: string };
  status: "ACTIVE" | "COMPLETED";
  completedAt: Date | null;
  completedLessonCount: number;
  totalLessonCount: number;
  percent: number;
};

export type ProfileSummary = {
  user: { displayName: string; email: string } | null;
  enrollments: ProfileEnrollment[];
};

export async function getProfileSummary(
  userId: string,
): Promise<ProfileSummary> {
  const userRows = await db
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const enrollmentRows = await db
    .select({
      enrollmentId: enrollments.id,
      status: enrollments.status,
      completedAt: enrollments.completedAt,
      courseId: courses.id,
      courseSlug: courses.slug,
      courseTitle: courses.title,
    })
    .from(enrollments)
    .innerJoin(
      courses,
      and(
        eq(courses.id, enrollments.courseId),
        eq(courses.status, "PUBLISHED"),
      ),
    )
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.enrolledAt));

  if (enrollmentRows.length === 0) {
    return { user: userRows[0] ?? null, enrollments: [] };
  }

  const courseIds = [...new Set(enrollmentRows.map((row) => row.courseId))];
  const enrollmentIds = enrollmentRows.map((row) => row.enrollmentId);

  // Denominator: the PUBLISHED lesson set per course (BR §38).
  const totalsRows = await db
    .select({ courseId: lessons.courseId, total: count() })
    .from(lessons)
    .where(
      and(inArray(lessons.courseId, courseIds), eq(lessons.status, "PUBLISHED")),
    )
    .groupBy(lessons.courseId);

  // Numerator: COMPLETED progress rows that reference PUBLISHED
  // lessons — progress on DRAFT lessons never surfaces as current
  // progress (the same set discipline as getCourseProgress).
  const completedRows = await db
    .select({
      enrollmentId: lessonProgress.enrollmentId,
      completed: count(),
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .where(
      and(
        inArray(lessonProgress.enrollmentId, enrollmentIds),
        eq(lessonProgress.status, "COMPLETED"),
        eq(lessons.status, "PUBLISHED"),
      ),
    )
    .groupBy(lessonProgress.enrollmentId);

  const totalsByCourse = new Map(totalsRows.map((row) => [row.courseId, row.total]));
  const completedByEnrollment = new Map(
    completedRows.map((row) => [row.enrollmentId, row.completed]),
  );

  const enrollmentsOut: ProfileEnrollment[] = enrollmentRows.map((row) => {
    const totalLessonCount = totalsByCourse.get(row.courseId) ?? 0;
    const completedLessonCount =
      completedByEnrollment.get(row.enrollmentId) ?? 0;

    return {
      course: { slug: row.courseSlug, title: row.courseTitle },
      status: row.status,
      completedAt: row.completedAt,
      completedLessonCount,
      totalLessonCount,
      percent:
        totalLessonCount === 0
          ? 0
          : Math.round((completedLessonCount / totalLessonCount) * 100),
    };
  });

  return { user: userRows[0] ?? null, enrollments: enrollmentsOut };
}
