"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { questionOptions, questions } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

import { parseQuestionForm } from "./parseQuestionForm";
import type { QuestionFormState } from "../schemas/question-form.schema";

/**
 * BINZI Question Edit server action (TASK 031, Blueprint §26,
 * BR §14/§15/§24, CMS §22/§24).
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → load/verify target (locked) → execute
 * atomically → safe result. The action is bound to the question id
 * by the edit page (server-side), so the id is never client input.
 *
 * REUSABILITY (CMS §23/§24): a Question is a bank entity — this
 * action only ever writes questions.question_text/explanation and
 * this question's question_options rows. quiz_questions,
 * quizzes, quiz_attempts, and quiz_answers are NEVER touched:
 * editing cannot move a question between quizzes, break existing
 * quiz assignments, or rewrite frozen answer history.
 *
 * OPTION SYNC (in-place, keyed by server-rendered row ids):
 * the edit form posts each existing option's question_options.id
 * back as a hidden row key. The action verifies EVERY posted id
 * belongs to THIS question (cross-question forgery dies before
 * any write), then syncs atomically inside ONE transaction:
 *   1. Lock the question row (FOR UPDATE), then its option rows
 *      in sort_order order — the same lock ordering family as
 *      TASK 025–029 (no deadlocks).
 *   2. DELETE only the options the admin actually removed.
 *      quiz_answers.selected_option_id RESTRICTs this: an option
 *      already chosen by a learner fails closed (rollback, zero
 *      writes, actionable message) — history is never destroyed.
 *      No removal workflow beyond this exists in V1 (FLAG).
 *   3. sort_order renumber uses the proven two-phase strategy
 *      (TASK 026/029) so UNIQUE(question_id, sort_order) holds at
 *      every intermediate state: shift all surviving rows by +K
 *      (K = max(before, after) counts → temporary K+1..K+M can
 *      never collide with final values 1..P), then write the
 *      final contiguous 1..P per row id / on insert.
 *   4. UPDATE surviving rows' text/is_correct; INSERT new rows.
 *
 * EXACTLY ONE CORRECT (BR §14/§15) is validated from the FINAL
 * row set before anything is written: flags are derived from the
 * single validated correctIndex and the count is asserted to be
 * exactly 1 — the radio UI is only a first gate; forged payloads
 * (zero/multiple correct) are rejected with zero writes. Row-
 * level CHECK cannot express this; quiz publish validation
 * (TASK 035) re-checks independently.
 *
 * updated_at is maintained by the schema's $onUpdate. Raw
 * database errors are never shown to users (CMS §45). Success
 * redirects to /admin/questions, where the edited question sorts
 * to the top (updatedAt DESC, TASK 030).
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres foreign_key_violation (RESTRICT on answered options). */
const FK_VIOLATION_CODE = "23503";

const NOT_FOUND_MESSAGE = "Soal tidak ditemukan atau sudah dihapus.";

function isFkViolation(error: unknown): boolean {
  // drizzle-orm wraps query failures in DrizzleQueryError, so the
  // Postgres error code lives on the .cause chain, not the top level.
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === FK_VIOLATION_CODE
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function updateQuestionAction(
  questionId: string,
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  // 1. Authenticate — Supabase cookie session, validated server-side.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "Sesi tidak valid. Silakan masuk kembali.",
    };
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return {
      status: "error",
      message: "Anda tidak memiliki izin untuk menyunting soal.",
    };
  }

  // 3. Validate — zod at the boundary (Blueprint §14), after the
  //    tamper-hardened form collection (see parseQuestionForm).
  const parsed = parseQuestionForm(formData);
  if (!parsed.ok) {
    return { status: "error", errors: parsed.errors };
  }

  const { questionText, explanation, options, correctIndex } = parsed.data;

  if (!UUID_PATTERN.test(questionId)) {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }

  // Final-set assertion BEFORE any write: exactly one correct row.
  const finalRows = options.map((option, index) => ({
    optionId: option.optionId,
    optionText: option.optionText,
    sortOrder: index + 1,
    isCorrect: index === correctIndex,
  }));
  if (finalRows.filter((row) => row.isCorrect).length !== 1) {
    return {
      status: "error",
      errors: { correctIndex: "Pilih satu opsi sebagai jawaban benar." },
    };
  }

  // 4. Load/verify + execute — one transaction.
  try {
    await db.transaction(async (tx) => {
      // Lock the question row first (serialization point).
      const [question] = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.id, questionId))
        .for("update")
        .limit(1);

      if (!question) {
        throw new QuestionNotFound();
      }

      // Lock the option rows in sort_order order (stable family
      // lock ordering; also the order the renumber walks).
      const existing = await tx
        .select({
          id: questionOptions.id,
          sortOrder: questionOptions.sortOrder,
        })
        .from(questionOptions)
        .where(eq(questionOptions.questionId, questionId))
        .orderBy(asc(questionOptions.sortOrder))
        .for("update");

      // Ownership: every posted row id must belong to THIS
      // question — cross-question option ids die before any write.
      const existingIds = new Set(existing.map((row) => row.id));
      for (const row of finalRows) {
        if (row.optionId !== undefined && !existingIds.has(row.optionId)) {
          throw new QuestionNotFound();
        }
      }

      // Rows removed by the admin: existing ids absent from the
      // payload. RESTRICT protects options learners already chose.
      const keptIds = new Set(
        finalRows.map((row) => row.optionId).filter((id) => id !== undefined),
      );
      const removedIds = existing
        .map((row) => row.id)
        .filter((id) => !keptIds.has(id));

      if (removedIds.length > 0) {
        await tx
          .delete(questionOptions)
          .where(
            and(
              eq(questionOptions.questionId, questionId),
              inArray(questionOptions.id, removedIds),
            ),
          );
      }

      // Phase 1 — shift every surviving row into a temporary range
      // that final values can never collide with.
      const shift = Math.max(existing.length, finalRows.length);
      if (keptIds.size > 0) {
        await tx
          .update(questionOptions)
          .set({ sortOrder: sql`${questionOptions.sortOrder} + ${shift}` })
          .where(
            and(
              eq(questionOptions.questionId, questionId),
              inArray(questionOptions.id, [...keptIds]),
            ),
          );
      }

      // Phase 2 — write the final contiguous 1..P, per row.
      for (const row of finalRows) {
        if (row.optionId !== undefined) {
          await tx
            .update(questionOptions)
            .set({
              optionText: row.optionText,
              sortOrder: row.sortOrder,
              isCorrect: row.isCorrect,
            })
            .where(
              and(
                eq(questionOptions.questionId, questionId),
                eq(questionOptions.id, row.optionId),
              ),
            );
        } else {
          await tx.insert(questionOptions).values({
            questionId,
            optionText: row.optionText,
            sortOrder: row.sortOrder,
            isCorrect: row.isCorrect,
          });
        }
      }

      // Question text/explanation only — never quiz linkage or
      // timestamps (updated_at is $onUpdate-maintained).
      await tx
        .update(questions)
        .set({ questionText, explanation: explanation ?? null })
        .where(eq(questions.id, questionId));
    });
  } catch (error) {
    if (error instanceof QuestionNotFound) {
      return { status: "error", message: NOT_FOUND_MESSAGE };
    }
    if (isFkViolation(error)) {
      // Fail-closed: an option chosen by a learner cannot be
      // deleted (quiz_answers RESTRICT). Nothing was written.
      console.error("[questions/update] rejected: answered option removal");
      return {
        status: "error",
        message:
          "Opsi ini sudah dipilih peserta dalam riwayat kuis dan tidak dapat dihapus. Hapus tanda hapus pada opsi tersebut, atau buat soal baru.",
      };
    }
    console.error("[questions/update] update failed:", error);
    return {
      status: "error",
      message: "Gagal menyimpan soal. Silakan coba lagi.",
    };
  }

  // 5. Success — back to the Question Bank (TASK 030).
  redirect("/admin/questions");
}

/** Control-flow marker for a missing/forged question target. */
class QuestionNotFound extends Error {
  constructor() {
    super("question not found or option id not owned by question");
    this.name = "QuestionNotFound";
  }
}
