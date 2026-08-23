"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses, quizQuestions, quizzes } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

/**
 * BINZI Final Quiz remove-Question server action (TASK 034, Task
 * Plan "Build Final Quiz", CMS Spec §7/§20/§23/§25, BR §16, Blueprint
 * §27, Decisions Log #11).
 *
 * Removal deletes ONLY the quiz_questions membership row. The
 * Question, its options, other quizzes' memberships (Lesson Quizzes
 * included — the same Question may sit in a Lesson Quiz AND this
 * Final Quiz, CMS §23), the lessons, and the course are never
 * touched — the Question simply returns to the reusable bank. An
 * emptied quiz row persists (0 questions = "not publishable", CMS
 * §29); TASK 034 never deletes quiz rows.
 *
 * After the delete, the remaining rows are renumbered to the
 * contiguous 1..M run with the proven two-phase strategy (TASK
 * 026/029/031/033): a naive decrement can transiently violate
 * UNIQUE(quiz_id, sort_order) (6→5 before 5→4), so inside ONE
 * transaction, after locking course → quiz → membership rows:
 *   Phase 1 — shift every remaining row by +K (K = row count BEFORE
 *   the delete): temporary values all exceed every pre-delete value,
 *   so the single shifting UPDATE can never collide mid-statement.
 *   Phase 2 — write the final contiguous 1..M per remaining row, in
 *   the persisted relative order. Final values (≤ M) can never
 *   collide with not-yet-rewritten temporary values (≥ K + 1 > M).
 * A post-verification SELECT inside the transaction asserts the
 * final sequence is exactly 1..M or the transaction rolls back.
 *
 * quizId is NEVER client input — it is resolved server-side from the
 * bound courseId (course → its one FINAL quiz). The posted
 * questionId must belong to that quiz's locked membership set;
 * unknown or cross-quiz ids die before any write.
 *
 * Input contract — deliberately minimal: the client sends ONLY
 * `questionId`; the course binding comes from the action's
 * server-side bind. NOTHING else is read from the payload.
 *
 * Feedback (TASK 028/033 convention, panel-scoped): benign
 * rejections redirect with a `finalQuizError` URL flag — `locked`,
 * `missing`, `invalid`. Success redirects plainly; the re-rendered
 * quiz list is the success state.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

export async function removeQuestionFromFinalQuizAction(
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
    console.error("[final-quiz/remove] rejected: no session");
    redirect("/login");
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    console.error("[final-quiz/remove] rejected: not admin");
    redirect(builderHref);
  }

  // 3. Validate the minimal input contract.
  const questionId = formValue(formData, "questionId");

  if (!UUID_PATTERN.test(courseId)) {
    console.error("[final-quiz/remove] rejected: malformed route id");
    redirect(`${builderHref}?finalQuizError=invalid`);
  }
  if (!questionId || !UUID_PATTERN.test(questionId)) {
    console.error("[final-quiz/remove] rejected: malformed questionId");
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
        throw new RemoveRejected("missing", "course not found");
      }
      if (course.status === "PUBLISHED") {
        throw new RemoveRejected(
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
        throw new RemoveRejected("missing", "course has no final quiz");
      }

      // Lock the quiz's membership rows in sort_order order (the same
      // lock ordering as the add/reorder actions — no deadlocks).
      const rows = await tx
        .select({
          questionId: quizQuestions.questionId,
          sortOrder: quizQuestions.sortOrder,
        })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quiz.id))
        .orderBy(asc(quizQuestions.sortOrder))
        .for("update");

      // Ownership: the Question must belong to THIS quiz's locked
      // membership set — unknown or cross-quiz questionIds die here,
      // before any write.
      const target = rows.find((row) => row.questionId === questionId);
      if (!target) {
        throw new RemoveRejected(
          "missing",
          "question not assigned to this quiz",
        );
      }

      // Delete the membership row ONLY (see header note).
      await tx
        .delete(quizQuestions)
        .where(
          and(
            eq(quizQuestions.quizId, quiz.id),
            eq(quizQuestions.questionId, questionId),
          ),
        );

      const countBefore = rows.length;
      const remaining = countBefore - 1;

      // Phase 1 — shift every remaining row by +countBefore
      // (temporary values all exceed every pre-delete value).
      if (remaining > 0) {
        await tx
          .update(quizQuestions)
          .set({ sortOrder: sql`${quizQuestions.sortOrder} + ${countBefore}` })
          .where(eq(quizQuestions.quizId, quiz.id));
      }

      // Phase 2 — write the final contiguous 1..M, in the persisted
      // relative order.
      const shifted = await tx
        .select({ questionId: quizQuestions.questionId })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quiz.id))
        .orderBy(asc(quizQuestions.sortOrder));
      for (let i = 0; i < shifted.length; i += 1) {
        await tx
          .update(quizQuestions)
          .set({ sortOrder: i + 1 })
          .where(
            and(
              eq(quizQuestions.quizId, quiz.id),
              eq(quizQuestions.questionId, shifted[i].questionId),
            ),
          );
      }

      // Post-verify inside the transaction: exactly 1..M, each once,
      // and the removed question is gone from this quiz only.
      const finalRows = await tx
        .select({
          questionId: quizQuestions.questionId,
          sortOrder: quizQuestions.sortOrder,
        })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quiz.id))
        .orderBy(asc(quizQuestions.sortOrder));
      const expected = Array.from({ length: remaining }, (_, i) => i + 1);
      const actual = finalRows.map((row) => row.sortOrder);
      if (
        finalRows.length !== remaining ||
        actual.some((value, i) => value !== expected[i]) ||
        finalRows.some((row) => row.questionId === questionId)
      ) {
        throw new Error(
          `[final-quiz/remove] post-verification failed: ${JSON.stringify(actual)}`,
        );
      }
    });
  } catch (error) {
    if (error instanceof RemoveRejected) {
      console.error(`[final-quiz/remove] rejected: ${error.detail}`);
      redirect(`${builderHref}?finalQuizError=${error.flag}`);
    }
    console.error("[final-quiz/remove] transaction failed:", error);
    redirect(`${builderHref}?finalQuizError=invalid`);
  }

  // 5. Success — back to the Course Builder, whose re-rendered quiz
  //    list is the success state. redirect() throws, so nothing
  //    returns.
  redirect(builderHref);
}

/** Control-flow marker for rejected (non-error) removals. */
class RemoveRejected extends Error {
  /** URL flag the builder renders as an actionable message. */
  readonly flag: "locked" | "missing";
  readonly detail: string;

  constructor(flag: "locked" | "missing", detail: string) {
    super(detail);
    this.name = "RemoveRejected";
    this.flag = flag;
    this.detail = detail;
  }
}
