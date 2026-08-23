"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses, quizQuestions, quizzes } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

/**
 * BINZI Final Quiz question-ordering server action (TASK 034, Task
 * Plan "Build Final Quiz", CMS Spec §7/§20/§25 "Questions inside a
 * Quiz have an explicit order … Persist ordering through
 * quiz_questions.sort_order", BR §16, Blueprint §27, Decisions Log
 * #11).
 *
 * The persisted sequence is always the contiguous run 1..N; the
 * ordering UI updates the server rather than relying only on local
 * state (CMS §25 wording, mirrored from §26 by TASK 029/033).
 *
 * Input contract — deliberately minimal. The client sends ONLY:
 * - `questionId`     — the assigned Question to move (must belong to
 *   this quiz's locked membership set)
 * - `targetPosition` — the 1-based position the Question moves to
 * The course binding comes from the action's server-side bind
 * (never hidden fields). NOTHING else is read from the payload.
 *
 * Atomic renumber strategy (UNIQUE(quiz_id, sort_order) safety) —
 * the proven TASK 029/033 algorithm: inside ONE transaction, after
 * locking the course row (publish state re-checked under the lock,
 * Decisions #11), the quiz row (server-derived from the course —
 * quizId is never client input), and the quiz's membership rows in
 * sort_order order (the same lock ordering as the add/remove
 * actions — no deadlocks):
 *   Phase 1 — shift EVERY membership of the quiz by +N (N = row
 *   count): values become N+1..2N, still distinct, still > 0 (CHECK).
 *   Phase 2 — write each final 1..N value, targeted by (quiz_id,
 *   question_id) — UNIQUE(quiz_id, question_id) makes each UPDATE hit
 *   exactly one row. Final values (≤ N) can never collide with
 *   not-yet-rewritten temporary values (≥ N+1), so every
 *   intermediate state satisfies the constraint.
 * A post-verification SELECT inside the transaction asserts the
 * final sequence is exactly 1..N or the transaction rolls back.
 * Only sort_order is written — question_id and quiz_id columns are
 * never touched, so membership can never change (this action
 * reorders; it never reassigns).
 *
 * No-op (same position): persist nothing, succeed idempotently —
 * repeated requests and boundary buttons cost zero writes.
 *
 * Feedback (TASK 028/033 convention, panel-scoped): benign
 * rejections redirect with a `finalQuizError` URL flag — `locked`,
 * `missing`, `invalid`. Success redirects plainly; the re-rendered
 * ordered list is the success state.
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

export async function reorderFinalQuizQuestionAction(
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
    console.error("[final-quiz/reorder] rejected: no session");
    redirect("/login");
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    console.error("[final-quiz/reorder] rejected: not admin");
    redirect(builderHref);
  }

  // 3. Validate the minimal input contract.
  const questionId = formValue(formData, "questionId");

  if (!UUID_PATTERN.test(courseId)) {
    console.error("[final-quiz/reorder] rejected: malformed route id");
    redirect(`${builderHref}?finalQuizError=invalid`);
  }
  if (!questionId || !UUID_PATTERN.test(questionId)) {
    console.error("[final-quiz/reorder] rejected: malformed questionId");
    redirect(`${builderHref}?finalQuizError=invalid`);
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

      // Resolve THIS course's Final Quiz (identity is server-derived —
      // quizId is never client input) and lock it.
      const [quiz] = await tx
        .select({ id: quizzes.id })
        .from(quizzes)
        .where(and(eq(quizzes.courseId, courseId), eq(quizzes.type, "FINAL")))
        .for("update")
        .limit(1);

      if (!quiz) {
        throw new ReorderRejected("missing", "course has no final quiz");
      }

      // Lock the quiz's membership rows in sort_order order (stable
      // lock acquisition order; also the order the add/remove actions
      // take, so all three serialize against each other).
      const rows = await tx
        .select({
          questionId: quizQuestions.questionId,
          sortOrder: quizQuestions.sortOrder,
        })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quiz.id))
        .orderBy(asc(quizQuestions.sortOrder))
        .for("update");

      const count = rows.length;
      if (count === 0) {
        // Only reachable via a forged POST — the UI renders no
        // ordering controls for an empty quiz.
        throw new ReorderRejected("missing", "quiz has no questions");
      }

      // Ownership: the Question must belong to THIS quiz's locked
      // membership set — unknown or cross-quiz questionIds die here,
      // before any write.
      const fromIndex = rows.findIndex((row) => row.questionId === questionId);
      if (fromIndex === -1) {
        throw new ReorderRejected("missing", "question not in this quiz");
      }

      const targetPosition = parsePosition(
        formValue(formData, "targetPosition"),
        count,
      );
      if (targetPosition === null) {
        throw new ReorderRejected("invalid", "invalid targetPosition");
      }

      // Compute the new sequence: remove, then insert at the target.
      const ids = rows.map((row) => row.questionId);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(targetPosition - 1, 0, moved);

      // Sanity: same Question set, contiguous target range.
      if (ids.length !== count || new Set(ids).size !== count) {
        throw new ReorderRejected("invalid", "computed order lost questions");
      }

      // No-op (same position): persist nothing, succeed idempotently.
      const hasChange = rows.some((row, i) => row.questionId !== ids[i]);
      if (!hasChange) {
        return;
      }

      // Phase 1 — shift every row by +count (temporary N+1..2N).
      await tx
        .update(quizQuestions)
        .set({ sortOrder: sql`${quizQuestions.sortOrder} + ${count}` })
        .where(eq(quizQuestions.quizId, quiz.id));

      // Phase 2 — write the final 1..N value for EVERY row: Phase 1
      // shifted all of them into the temporary range, so each must be
      // brought back to its final slot.
      for (let i = 0; i < count; i += 1) {
        await tx
          .update(quizQuestions)
          .set({ sortOrder: i + 1 })
          .where(
            and(
              eq(quizQuestions.quizId, quiz.id),
              eq(quizQuestions.questionId, ids[i]),
            ),
          );
      }

      // Post-verify inside the transaction: exactly 1..N, each once.
      const finalRows = await tx
        .select({ sortOrder: quizQuestions.sortOrder })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quiz.id))
        .orderBy(asc(quizQuestions.sortOrder));
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      const actual = finalRows.map((row) => row.sortOrder);
      if (
        actual.length !== count ||
        actual.some((value, i) => value !== expected[i])
      ) {
        throw new Error(
          `[final-quiz/reorder] post-verification failed: ${JSON.stringify(actual)}`,
        );
      }
    });
  } catch (error) {
    if (error instanceof ReorderRejected) {
      console.error(`[final-quiz/reorder] rejected: ${error.detail}`);
      redirect(`${builderHref}?finalQuizError=${error.flag}`);
    }
    console.error("[final-quiz/reorder] transaction failed:", error);
    redirect(`${builderHref}?finalQuizError=invalid`);
  }

  // 5. Success — back to the Course Builder, whose re-rendered ordered
  //    quiz list is the success state. redirect() throws, so nothing
  //    returns.
  redirect(builderHref);
}

/** Control-flow marker for rejected (non-error) reorders. */
class ReorderRejected extends Error {
  /** URL flag the builder renders as an actionable message. */
  readonly flag: "locked" | "missing" | "invalid";
  readonly detail: string;

  constructor(flag: "locked" | "missing" | "invalid", detail: string) {
    super(detail);
    this.name = "ReorderRejected";
    this.flag = flag;
    this.detail = detail;
  }
}
