"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { courses, enrollments } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Enrollment action (TASK 042, Business Rules §8 "Enrollment may be
 * created when an authenticated user starts a Course"; UI/UX §9 "Do
 * not create a complex enrollment funnel in V1").
 *
 * Bound to the course SLUG on the server (the 028 convention of
 * binding the entity identifier server-side, adapted to the public
 * identifier — the page never needs the course UUID in the DOM).
 * The client submits nothing beyond the form itself.
 *
 * Boundary discipline:
 * - Authentication is enforced INSIDE the action (the Course Detail
 *   page is public, so an anonymous visitor can reach this form;
 *   the proxy that guards /learn does not guard this POST). Anonymous
 *   callers are redirected to /login — the §9 guest state.
 * - Publication is enforced at write time: only a course whose
 *   status is PUBLISHED at the moment of insert can be enrolled
 *   (Decisions Log #2 — "New users cannot enroll" once unpublished;
 *   existing enrollments are untouched by this path). A DRAFT or
 *   unknown slug renders the same notFound() as the page — drafts
 *   stay publicly indistinguishable (UI/UX §44).
 * - Exactly one enrollment per user + course (BR §8): the insert
 *   uses ON CONFLICT DO NOTHING against
 *   enrollments_user_course_unique, so a double submit or a race
 *   with a concurrent tab is an idempotent no-op, never an error.
 * - NO lesson_progress rows are created here (Decisions Log #12 —
 *   progress is created lazily when the user actually opens a
 *   lesson, a later milestone).
 *
 * Every rejection logs its reason server-side (the CMS mutation
 * convention); success redirects into the learning experience
 * route owned by TASK 045 (an honest 404 until that task lands —
 * the same approved future-route pattern as TASK 039/040).
 */
export async function enrollCourse(slug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.info("enrollCourse rejected: unauthenticated caller");
    redirect("/login");
  }

  const courseRows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.slug, slug), eq(courses.status, "PUBLISHED")))
    .limit(1);

  const course = courseRows[0];
  if (!course) {
    // DRAFT, unpublished, or unknown — indistinguishable by contract.
    console.info(
      "enrollCourse rejected: course not found or not published",
    );
    redirect("/courses");
  }

  await db
    .insert(enrollments)
    .values({ userId: user.id, courseId: course.id })
    .onConflictDoNothing({
      target: [
        enrollments.userId,
        enrollments.courseId,
      ],
    });

  redirect(`/courses/${slug}/learn`);
}
