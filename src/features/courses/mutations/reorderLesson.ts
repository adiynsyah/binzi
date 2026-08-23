"use server";

import { asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses, lessons } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

/**
 * BINZI Lesson Ordering server action (TASK 026, CMS Spec §7, BR
 * §3.2/§27, Blueprint §23/§24).
 *
 * Contract (BR §3.2/§27): sort_order is the explicit, persisted,
 * server-owned source of truth; the persisted sequence is always the
 * contiguous run 1..N; ordering may be changed by an Admin.
 *
 * Input contract — deliberately minimal. The client sends ONLY:
 * - `lessonId`   — the lesson to move (must belong to the bound course)
 * - `targetPosition` — the 1-based position the lesson moves to
 * The course binding comes from the action's server-side bind (never
 * a hidden field). NOTHING else is read from the payload: status,
 * publishedAt, ids, timestamps, or any other server-owned field sent
 * by the client is ignored entirely — they are not part of the
 * ordering contract.
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → load/verify target (course + lesson set,
 * locked) → execute atomically → safe result. Fail closed: every
 * rejection path writes nothing and logs server-side (CMS §45).
 *
 * Atomic renumber strategy (UNIQUE(course_id, sort_order) safety):
 * a naive pairwise swap can violate the unique constraint mid-flight
 * (A→2 while B still holds 2). Inside ONE transaction, after locking
 * the course row (serializes against concurrent reorders and the
 * TASK 025 create, which locks the same row first — no deadlocks)
 * and the course's lesson rows:
 *   Phase 1 — shift EVERY lesson of the course by +N (N = lesson
 *   count): values become N+1..2N, still distinct, still > 0 (CHECK).
 *   Phase 2 — write each final 1..N value. Final values (≤ N) can
 *   never collide with not-yet-rewritten temporary values (≥ N+1),
 *   so every intermediate state satisfies the constraint.
 * A post-verification SELECT inside the transaction asserts the
 * final sequence is exactly 1..N (each lesson once) or the
 * transaction rolls back. Only the lessons of THIS course are
 * touched; no other table is written.
 *
 * Published courses (Decisions Log #11): the course row is locked
 * with SELECT ... FOR UPDATE and its status re-checked, so a course
 * published after the page rendered (stale form / TOCTOU) is still
 * rejected with zero writes.
 *
 * The action returns void: button submissions are plain forms (works
 * without JavaScript) and drag-and-drop calls it imperatively; on
 * success — and on any benign rejection, where the redirect simply
 * shows the current persisted order — the admin lands back on the
 * Course Builder.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Positive integer 1..max (no zero, negatives, decimals, junk). */
function parsePosition(value: string | undefined, max: number): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  if (parsed > max) return null;
  return parsed;
}

export async function reorderLessonAction(
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
    console.error("[lessons/reorder] rejected: no session");
    redirect("/login");
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    console.error("[lessons/reorder] rejected: not admin");
    redirect(builderHref);
  }

  // 3. Validate the minimal input contract.
  const lessonId = formValue(formData, "lessonId");

  if (!UUID_PATTERN.test(courseId)) {
    console.error("[lessons/reorder] rejected: malformed courseId");
    redirect(builderHref);
  }
  if (!lessonId || !UUID_PATTERN.test(lessonId)) {
    console.error("[lessons/reorder] rejected: malformed lessonId");
    redirect(builderHref);
  }

  // 4. Load/verify + execute — one transaction (see strategy above).
  try {
    await db.transaction(async (tx) => {
      // Lock the course row: serializes concurrent ordering/creates for
      // this course and re-checks publish state under the lock
      // (Decisions #11).
      const [course] = await tx
        .select({ id: courses.id, status: courses.status })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (!course) {
        throw new ReorderRejected("course not found");
      }
      if (course.status === "PUBLISHED") {
        throw new ReorderRejected("course is PUBLISHED (Decisions #11)");
      }

      // Lock the course's lesson rows in sort_order order (stable lock
      // acquisition order).
      const rows = await tx
        .select({ id: lessons.id, sortOrder: lessons.sortOrder })
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
        .orderBy(asc(lessons.sortOrder))
        .for("update");

      const count = rows.length;
      if (count === 0) {
        throw new ReorderRejected("course has no lessons");
      }

      // Ownership: the lesson must belong to THIS course's locked set —
      // cross-course or unknown lessonIds die here, before any write.
      const fromIndex = rows.findIndex((row) => row.id === lessonId);
      if (fromIndex === -1) {
        throw new ReorderRejected("lesson not in course");
      }

      const targetPosition = parsePosition(
        formValue(formData, "targetPosition"),
        count,
      );
      if (targetPosition === null) {
        throw new ReorderRejected("invalid targetPosition");
      }

      // Compute the new sequence: remove, then insert at the target.
      const ids = rows.map((row) => row.id);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(targetPosition - 1, 0, moved);

      // Sanity: same lesson set, contiguous target range.
      if (ids.length !== count || new Set(ids).size !== count) {
        throw new ReorderRejected("computed order lost lessons");
      }

      // No-op (same position): persist nothing, succeed idempotently.
      const hasChange = rows.some((row, i) => row.id !== ids[i]);
      if (!hasChange) {
        return;
      }

      // Phase 1 — shift every row by +count (temporary N+1..2N).
      await tx
        .update(lessons)
        .set({ sortOrder: sql`${lessons.sortOrder} + ${count}` })
        .where(eq(lessons.courseId, courseId));

      // Phase 2 — write the final 1..N value for EVERY row: Phase 1
      // shifted all of them into the temporary range, so each must be
      // brought back to its final slot (finals ≤ N can never collide
      // with not-yet-rewritten temps ≥ N+1). Writing only the rows
      // whose position changed would strand the rest at temp values.
      for (let i = 0; i < count; i += 1) {
        await tx
          .update(lessons)
          .set({ sortOrder: i + 1 })
          .where(eq(lessons.id, ids[i]));
      }

      // Post-verify inside the transaction: exactly 1..N, each once.
      const finalRows = await tx
        .select({ sortOrder: lessons.sortOrder })
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
        .orderBy(asc(lessons.sortOrder));
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      const actual = finalRows.map((row) => row.sortOrder);
      if (
        actual.length !== count ||
        actual.some((value, i) => value !== expected[i])
      ) {
        throw new Error(
          `[lessons/reorder] post-verification failed: ${JSON.stringify(actual)}`,
        );
      }
    });
  } catch (error) {
    if (error instanceof ReorderRejected) {
      // Benign, already logged via the label — redirect with zero writes.
      redirect(builderHref);
    }
    console.error("[lessons/reorder] transaction failed:", error);
    redirect(builderHref);
  }

  // 5. Success — back to the Course Builder (TASK 024), which re-reads
  //    the persisted order. redirect() throws, so nothing returns.
  redirect(builderHref);
}

/** Control-flow marker for rejected (non-error) reorders. */
class ReorderRejected extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ReorderRejected";
  }
}
