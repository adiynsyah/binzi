"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses, lessonContents, lessons } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

/**
 * BINZI Lesson Content Ordering server action (TASK 029, Task Plan
 * "Allow Admin to reorder Content within Lesson", CMS Spec §9/§26,
 * BR §3.3/§4.4/§27, Decisions Log #11).
 *
 * Contract (BR §4.4/§27, CMS §26): lesson_contents.sort_order is the
 * explicit, persisted, server-owned source of truth; the persisted
 * sequence is always the contiguous run 1..N; "the ordering UI should
 * update the server rather than relying only on local state".
 *
 * Input contract — deliberately minimal. The client sends ONLY:
 * - `contentId`      — the assigned Content to move (must belong to
 *   the bound lesson's locked assignment set)
 * - `targetPosition` — the 1-based position the Content moves to
 * The course AND lesson bindings come from the action's server-side
 * bind (never hidden fields). NOTHING else is read from the payload:
 * courseId, lessonId, userId, role, status, publishedAt, sortOrder,
 * timestamps, or any other server-owned field sent by the client is
 * ignored entirely — they are not part of the ordering contract.
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → load/verify target (course + lesson +
 * assignment set, locked) → execute atomically → safe result. Fail
 * closed: every rejection path writes nothing and logs server-side
 * (CMS §45).
 *
 * Atomic renumber strategy (UNIQUE(lesson_id, sort_order) safety):
 * a naive pairwise swap can violate the unique constraint mid-flight
 * (A→2 while B still holds 2). Inside ONE transaction, after locking
 * the course row, the lesson row (ownership re-checked under the
 * lock), and the lesson's lesson_contents rows in sort_order order
 * (the same lock ordering as TASK 025–028 — no deadlocks):
 *   Phase 1 — shift EVERY assignment of the lesson by +N (N = row
 *   count): values become N+1..2N, still distinct, still > 0 (CHECK).
 *   Phase 2 — write each final 1..N value, targeted by (lesson_id,
 *   content_id) — content_id is globally UNIQUE, so each UPDATE hits
 *   exactly one row. Final values (≤ N) can never collide with
 *   not-yet-rewritten temporary values (≥ N+1), so every
 *   intermediate state satisfies the constraint.
 * A post-verification SELECT inside the transaction asserts the
 * final sequence is exactly 1..N or the transaction rolls back.
 * Only sort_order of THIS lesson's rows is written — content_id and
 * lesson_id columns are never touched, so ownership can never change
 * (TASK 029 reorders; it never reassigns).
 *
 * No-op (same position): persist nothing, succeed idempotently —
 * repeated requests and boundary buttons cost zero writes.
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
 * Lesson Editor. Benign rejections carry an `error` URL flag the
 * editor renders inline (TASK 028 convention): `locked`, `missing`,
 * `invalid`.
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

export async function reorderLessonContentAction(
  courseId: string,
  lessonId: string,
  formData: FormData,
): Promise<void> {
  const editorHref = `/admin/courses/${courseId}/lessons/${lessonId}`;

  // 1. Authenticate — Supabase cookie session, validated server-side.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[lesson-contents/reorder] rejected: no session");
    redirect("/login");
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    console.error("[lesson-contents/reorder] rejected: not admin");
    redirect(editorHref);
  }

  // 3. Validate the minimal input contract.
  const contentId = formValue(formData, "contentId");

  if (!UUID_PATTERN.test(courseId) || !UUID_PATTERN.test(lessonId)) {
    console.error("[lesson-contents/reorder] rejected: malformed route ids");
    redirect(`${editorHref}?error=invalid`);
  }
  if (!contentId || !UUID_PATTERN.test(contentId)) {
    console.error("[lesson-contents/reorder] rejected: malformed contentId");
    redirect(`${editorHref}?error=invalid`);
  }

  // 4. Load/verify + execute — one transaction (see strategy above).
  try {
    await db.transaction(async (tx) => {
      // Lock the course row: serializes concurrent structural mutations
      // for this course and re-checks publish state under the lock
      // (Decisions #11).
      const [course] = await tx
        .select({ id: courses.id, status: courses.status })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (!course) {
        throw new ReorderRejected("missing", "course not found");
      }
      if (course.status === "PUBLISHED") {
        throw new ReorderRejected(
          "locked",
          "course is PUBLISHED (Decisions #11)",
        );
      }

      // Load + lock the lesson row; ownership is re-verified under the
      // lock (courseId match), never trusted from the payload.
      const [lesson] = await tx
        .select({ id: lessons.id, courseId: lessons.courseId })
        .from(lessons)
        .where(eq(lessons.id, lessonId))
        .for("update")
        .limit(1);

      if (!lesson || lesson.courseId !== courseId) {
        throw new ReorderRejected("missing", "lesson not in course");
      }

      // Lock the lesson's assignment rows in sort_order order (stable
      // lock acquisition order; also the order TASK 028's append takes,
      // so assignment and reordering serialize against each other).
      const rows = await tx
        .select({
          contentId: lessonContents.contentId,
          sortOrder: lessonContents.sortOrder,
        })
        .from(lessonContents)
        .where(eq(lessonContents.lessonId, lessonId))
        .orderBy(asc(lessonContents.sortOrder))
        .for("update");

      const count = rows.length;
      if (count === 0) {
        // Only reachable via a forged POST — the UI renders no
        // ordering controls for an empty lesson.
        throw new ReorderRejected("missing", "lesson has no content");
      }

      // Ownership: the Content must belong to THIS lesson's locked
      // assignment set — unknown or cross-lesson contentIds die here,
      // before any write.
      const fromIndex = rows.findIndex((row) => row.contentId === contentId);
      if (fromIndex === -1) {
        throw new ReorderRejected("missing", "content not assigned to lesson");
      }

      const targetPosition = parsePosition(
        formValue(formData, "targetPosition"),
        count,
      );
      if (targetPosition === null) {
        throw new ReorderRejected("invalid", "invalid targetPosition");
      }

      // Compute the new sequence: remove, then insert at the target.
      const ids = rows.map((row) => row.contentId);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(targetPosition - 1, 0, moved);

      // Sanity: same Content set, contiguous target range.
      if (ids.length !== count || new Set(ids).size !== count) {
        throw new ReorderRejected("invalid", "computed order lost contents");
      }

      // No-op (same position): persist nothing, succeed idempotently.
      const hasChange = rows.some((row, i) => row.contentId !== ids[i]);
      if (!hasChange) {
        return;
      }

      // Phase 1 — shift every row by +count (temporary N+1..2N).
      await tx
        .update(lessonContents)
        .set({ sortOrder: sql`${lessonContents.sortOrder} + ${count}` })
        .where(eq(lessonContents.lessonId, lessonId));

      // Phase 2 — write the final 1..N value for EVERY row: Phase 1
      // shifted all of them into the temporary range, so each must be
      // brought back to its final slot (finals ≤ N can never collide
      // with not-yet-rewritten temps ≥ N+1). Writing only the rows
      // whose position changed would strand the rest at temp values.
      for (let i = 0; i < count; i += 1) {
        await tx
          .update(lessonContents)
          .set({ sortOrder: i + 1 })
          .where(
            and(
              eq(lessonContents.lessonId, lessonId),
              eq(lessonContents.contentId, ids[i]),
            ),
          );
      }

      // Post-verify inside the transaction: exactly 1..N, each once.
      const finalRows = await tx
        .select({ sortOrder: lessonContents.sortOrder })
        .from(lessonContents)
        .where(eq(lessonContents.lessonId, lessonId))
        .orderBy(asc(lessonContents.sortOrder));
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      const actual = finalRows.map((row) => row.sortOrder);
      if (
        actual.length !== count ||
        actual.some((value, i) => value !== expected[i])
      ) {
        throw new Error(
          `[lesson-contents/reorder] post-verification failed: ${JSON.stringify(actual)}`,
        );
      }
    });
  } catch (error) {
    if (error instanceof ReorderRejected) {
      // Benign rejection — CMS §45 logs the reason; the redirect flag
      // gives the admin an actionable message (TASK 028 convention).
      console.error(`[lesson-contents/reorder] rejected: ${error.detail}`);
      redirect(`${editorHref}?error=${error.flag}`);
    }
    console.error("[lesson-contents/reorder] transaction failed:", error);
    redirect(`${editorHref}?error=invalid`);
  }

  // 5. Success — back to the Lesson Editor, whose re-rendered assigned
  //    list (in the new persisted order) is the success state.
  //    redirect() throws, so nothing returns.
  redirect(editorHref);
}

/** Control-flow marker for rejected (non-error) reorders. */
class ReorderRejected extends Error {
  /** URL flag the editor renders as an actionable message. */
  readonly flag: "locked" | "missing" | "invalid";
  readonly detail: string;

  constructor(flag: "locked" | "missing" | "invalid", detail: string) {
    super(detail);
    this.name = "ReorderRejected";
    this.flag = flag;
    this.detail = detail;
  }
}
