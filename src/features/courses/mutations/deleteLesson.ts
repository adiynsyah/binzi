"use server";

import { asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses, lessonContents, lessons } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

/**
 * BINZI Lesson Delete server action (TASK 027, Task Plan "Draft Lesson →
 * can delete; Published Lesson → cannot delete", BR §3.4/§24/§28, CMS
 * §32/§33, Decisions Log #11).
 *
 * Deletion rules (all enforced server-side, fail closed):
 * - Course PUBLISHED → no structural change at all (Decisions #11);
 *   the status is re-checked under the course-row lock, so a stale
 *   form posted after publishing writes nothing (TOCTOU).
 * - Lesson PUBLISHED → may not be deleted (BR §3.4/§24/§28; CMS §32).
 * - Course DRAFT + Lesson DRAFT → deletion allowed (CMS §33; the UI
 *   confirms first — server-side validation remains mandatory).
 *
 * Input contract — deliberately minimal. The client sends ONLY
 * `lessonId`; the course binding comes from the action's server-side
 * bind (never a hidden field). NOTHING else is read from the payload:
 * status, publishedAt, sortOrder, ids, timestamps, or any other
 * server-owned field sent by the client is ignored entirely.
 *
 * Relational integrity (existing schema contract — no invented
 * cleanup, no CASCADE reliance):
 * - lesson_contents rows of the lesson are deleted explicitly in the
 *   same transaction (approved decision #20, schema doc on lessons;
 *   Drizzle Spec §19 "RESTRICT or explicit application-controlled
 *   deletion"). The referenced contents themselves are NEVER touched —
 *   they are independent CMS entities (BR §28).
 * - quizzes (LESSON type) and lesson_progress reference lessons with
 *   RESTRICT. No source authorizes deleting quizzes, quiz_questions,
 *   or learning history here, so if any such row exists the FK blocks
 *   the lesson DELETE, the transaction rolls back, and the action
 *   fails closed with zero writes (BR §28: prefer non-destructive
 *   behavior; Drizzle Spec §19: never silently destroy educational
 *   history).
 *
 * Ordering after deletion (BR §3.2/§27): the remaining lessons of the
 * course are renumbered to the exact contiguous run 1..M inside the
 * SAME transaction, using the TASK 026 two-phase strategy:
 *   Phase 1 — shift every remaining row by +N (N = count BEFORE the
 *   delete): values become distinct and > M.
 *   Phase 2 — write each final 1..M value (≤ M can never collide with
 *   not-yet-rewritten temps ≥ N+1).
 * A naive single decrement update is NOT safe: the unique constraint
 * is non-deferrable and Postgres checks it per-row in heap order
 * (empirically proven during TASK 026 fixture work).
 * A post-verification SELECT asserts the final sequence is exactly
 * 1..M (and the deleted lesson is gone) or the transaction rolls back.
 *
 * Lock ordering (deadlock-free, conventions of TASK 025/026): course
 * row FOR UPDATE first, then the course's lesson rows FOR UPDATE in
 * sort_order order. Concurrent create/reorder/delete on the same
 * course serialize on the course-row lock.
 *
 * The action returns void; on success — and on any benign rejection,
 * where the redirect simply shows the current persisted state — the
 * admin lands back on the Course Builder.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

export async function deleteLessonAction(
  courseId: string,
  formData: FormData,
): Promise<void> {
  const builderHref = `/admin/courses/${courseId}/edit`;

  // 1. Authenticate — Supabase cookie session, validated server-side.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[lessons/delete] rejected: no session");
    redirect("/login");
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    console.error("[lessons/delete] rejected: not admin");
    redirect(builderHref);
  }

  // 3. Validate the minimal input contract.
  const lessonId = formValue(formData, "lessonId");

  if (!UUID_PATTERN.test(courseId)) {
    console.error("[lessons/delete] rejected: malformed courseId");
    redirect(builderHref);
  }
  if (!lessonId || !UUID_PATTERN.test(lessonId)) {
    console.error("[lessons/delete] rejected: malformed lessonId");
    redirect(builderHref);
  }

  // 4. Load/verify + execute — one transaction (see strategy above).
  try {
    await db.transaction(async (tx) => {
      // Lock the course row: serializes concurrent create/reorder/delete
      // for this course and re-checks publish state under the lock
      // (Decisions #11).
      const [course] = await tx
        .select({ id: courses.id, status: courses.status })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (!course) {
        throw new DeleteRejected("course not found");
      }
      if (course.status === "PUBLISHED") {
        throw new DeleteRejected("course is PUBLISHED (Decisions #11)");
      }

      // Lock the course's lesson rows in sort_order order (stable lock
      // acquisition order).
      const rows = await tx
        .select({
          id: lessons.id,
          sortOrder: lessons.sortOrder,
          status: lessons.status,
        })
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
        .orderBy(asc(lessons.sortOrder))
        .for("update");

      // Ownership: the lesson must belong to THIS course's locked set —
      // cross-course or unknown lessonIds die here, before any write.
      const target = rows.find((row) => row.id === lessonId);
      if (!target) {
        throw new DeleteRejected("lesson not in course");
      }
      if (target.status === "PUBLISHED") {
        throw new DeleteRejected("lesson is PUBLISHED (BR §3.4)");
      }

      const originalCount = rows.length;
      const remaining = rows.filter((row) => row.id !== lessonId);

      // Explicit, application-controlled removal of the lesson's
      // content assignments (approved decision #20). The contents
      // themselves are never touched.
      await tx
        .delete(lessonContents)
        .where(eq(lessonContents.lessonId, lessonId));

      // Delete the lesson. If a LESSON quiz or lesson_progress row
      // still references it, the RESTRICT FK makes this statement
      // fail → the whole transaction rolls back (fail closed).
      await tx.delete(lessons).where(eq(lessons.id, lessonId));

      // Renumber the survivors to the exact contiguous 1..M run.
      if (remaining.length > 0) {
        // Phase 1 — shift every remaining row by +originalCount.
        await tx
          .update(lessons)
          .set({ sortOrder: sql`${lessons.sortOrder} + ${originalCount}` })
          .where(eq(lessons.courseId, courseId));

        // Phase 2 — write each final 1..M value for EVERY remaining
        // row (temps ≥ originalCount+1 can never collide with finals
        // ≤ remaining.length ≤ originalCount).
        for (let i = 0; i < remaining.length; i += 1) {
          await tx
            .update(lessons)
            .set({ sortOrder: i + 1 })
            .where(eq(lessons.id, remaining[i].id));
        }
      }

      // Post-verify inside the transaction: the deleted lesson is
      // gone, no assignment rows survive it, and the remaining
      // sequence is exactly 1..M, each lesson once.
      const finalRows = await tx
        .select({ id: lessons.id, sortOrder: lessons.sortOrder })
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
        .orderBy(asc(lessons.sortOrder));
      const expected = Array.from(
        { length: remaining.length },
        (_, i) => i + 1,
      );
      const actual = finalRows.map((row) => row.sortOrder);
      if (
        actual.length !== remaining.length ||
        actual.some((value, i) => value !== expected[i]) ||
        finalRows.some((row) => row.id === lessonId)
      ) {
        throw new Error(
          `[lessons/delete] post-verification failed: ${JSON.stringify(actual)}`,
        );
      }
      const orphaned = await tx
        .select({ id: lessonContents.id })
        .from(lessonContents)
        .where(eq(lessonContents.lessonId, lessonId))
        .limit(1);
      if (orphaned.length > 0) {
        throw new Error("[lessons/delete] post-verification failed: orphans");
      }
    });
  } catch (error) {
    if (error instanceof DeleteRejected) {
      // Benign rejection — CMS §45 requires the reason in server logs.
      console.error(`[lessons/delete] rejected: ${error.message}`);
      redirect(builderHref);
    }
    console.error("[lessons/delete] transaction failed:", error);
    redirect(builderHref);
  }

  // 5. Success — back to the Course Builder, which re-renders the
  //    remaining lessons (or the empty state when none remain).
  //    redirect() throws, so nothing returns.
  redirect(builderHref);
}

/** Control-flow marker for rejected (non-error) deletions. */
class DeleteRejected extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "DeleteRejected";
  }
}
