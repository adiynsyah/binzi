"use server";

import { redirect } from "next/navigation";

import { db } from "@/db";
import { questionOptions, questions } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

import { parseQuestionForm } from "./parseQuestionForm";
import type { QuestionFormState } from "../schemas/question-form.schema";

/**
 * BINZI Question Create server action (TASK 031, Blueprint §26,
 * BR §14/§15, CMS §22).
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → execute atomically → safe result.
 *
 * - Authentication uses the Supabase server client (cookie session
 *   validated by Supabase Auth); authorization re-reads the role
 *   from public.users via isUserAdmin (TASK 014). The role is never
 *   taken from the client. Both fail closed. The /admin/* proxy is
 *   NOT relied upon here.
 * - Input contract is exactly the form fields: question text,
 *   option rows, one correct-option selection, optional
 *   explanation. Ids, sort_order, timestamps, and any quiz linkage
 *   are server-owned and never read from the payload (questions
 *   are a reusable bank entity with NO status — creating never
 *   publishes anything; publish validation belongs to quizzes,
 *   TASK 035).
 * - Exactly-one-correct is enforced from the FINAL row set about
 *   to be persisted (BR §14/§15): the action derives each row's
 *   is_correct from the single validated correctIndex and asserts
 *   the count is exactly 1 before writing. The radio UI is only a
 *   first gate.
 * - Atomicity: the question row and ALL its option rows are
 *   written in ONE transaction — a failure anywhere leaves no
 *   partial question (no orphan options, no option-less question).
 * - sort_order is assigned server-side as the contiguous run 1..N
 *   in the submitted row order (UNIQUE(question_id, sort_order)
 *   satisfied by construction; CHECK > 0 likewise).
 * - Raw database errors are never shown to users (CMS §45):
 *   details go to server logs, users get a generic retry message.
 * - Success redirects to /admin/questions, where the new question
 *   sorts to the top (updatedAt DESC, TASK 030) — visible
 *   confirmation without a success page.
 */
export async function createQuestionAction(
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
      message: "Anda tidak memiliki izin untuk membuat soal.",
    };
  }

  // 3. Validate — zod at the boundary (Blueprint §14), after the
  //    tamper-hardened form collection (see parseQuestionForm).
  const parsed = parseQuestionForm(formData);
  if (!parsed.ok) {
    return { status: "error", errors: parsed.errors };
  }

  const { questionText, explanation, options, correctIndex } = parsed.data;

  // Final-set assertion: exactly one correct option (BR §15). The
  // is_correct flags are DERIVED here — never accepted from the
  // client (mirrors the frozen-answer decision #24 philosophy).
  const rows = options.map((option, index) => ({
    optionText: option.optionText,
    sortOrder: index + 1,
    isCorrect: index === correctIndex,
  }));
  if (rows.filter((row) => row.isCorrect).length !== 1) {
    return {
      status: "error",
      errors: { correctIndex: "Pilih satu opsi sebagai jawaban benar." },
    };
  }

  // 4. Execute — question + options in ONE transaction.
  try {
    await db.transaction(async (tx) => {
      const [question] = await tx
        .insert(questions)
        .values({ questionText, explanation: explanation ?? null })
        .returning({ id: questions.id });

      await tx.insert(questionOptions).values(
        rows.map((row) => ({
          questionId: question.id,
          optionText: row.optionText,
          sortOrder: row.sortOrder,
          isCorrect: row.isCorrect,
        })),
      );
    });
  } catch (error) {
    console.error("[questions/create] insert failed:", error);
    return {
      status: "error",
      message: "Gagal menyimpan soal. Silakan coba lagi.",
    };
  }

  // 5. Success — back to the Question Bank (TASK 030); the new
  //    question appears at the top. redirect() throws, so no state
  //    is returned.
  redirect("/admin/questions");
}
