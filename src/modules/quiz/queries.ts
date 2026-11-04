// Database access for the quiz domain (cards S1-01, S1-02).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import type { Db } from "@/db/client";
import { quizzes, systemSettings } from "@/db/schema";

/**
 * Transaction handle type: whatever `db.transaction` hands its callback.
 * Defined here (not in db/client) so the quiz service can re-export it
 * without a circular import.
 */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Insert the empty FINAL quiz that every new course gets (design 21g
 * "Sudah disiapkan kosong"; defaults from card S1-01: 20 minutes, 70%,
 * one attempt, explanations always). The values are editable later in the
 * S3 quiz editor. Runs INSIDE the caller's transaction — hence the tx handle.
 */
export async function insertEmptyFinalQuiz(tx: DbTx): Promise<{ id: string }> {
  const rows = await tx
    .insert(quizzes)
    .values({
      type: "FINAL",
      title: "Final Quiz",
      durationMinutes: 20,
      passingScorePercent: 70,
      maxAttempts: 1,
      explanationPolicy: "ALWAYS",
    })
    .returning({ id: quizzes.id });
  const row = rows[0];
  if (!row) {
    throw new Error("inserting the empty FINAL quiz returned no row");
  }
  return row;
}

/**
 * Insert the empty LESSON quiz that every new lesson gets in the SAME
 * transaction (card S1-02 §1, CRS-06, 21h "otomatis punya satu quiz
 * kosong"): 10 minutes, 70%, ONE attempt (locked for lesson quizzes,
 * §11.4 no. 9), explanations always. `title` = the lesson title at
 * creation time. The S3 quiz editor owns these values afterwards.
 */
export async function insertEmptyLessonQuiz(
  tx: DbTx,
  input: { title: string },
): Promise<{ id: string }> {
  const rows = await tx
    .insert(quizzes)
    .values({
      type: "LESSON",
      title: input.title,
      durationMinutes: 10,
      passingScorePercent: 70,
      maxAttempts: 1,
      explanationPolicy: "ALWAYS",
    })
    .returning({ id: quizzes.id });
  const row = rows[0];
  if (!row) {
    throw new Error("inserting the empty LESSON quiz returned no row");
  }
  return row;
}

/** system_settings key of the publish-time minimum question count (QZ-02). */
export const MIN_QUESTIONS_KEY = "quiz.min_questions";

/**
 * The JSON TEXT of quiz.min_questions (undefined when the row is absent).
 * Selected as ::text and parsed exactly ONCE by the caller: PGlite already
 * parses jsonb and drizzle's jsonb mapping would parse a returned string a
 * SECOND time, silently turning a stored JSON string "10" into the number
 * 10 — exactly the invalid shape the fail-closed check must catch.
 */
export async function selectMinQuestionsText(): Promise<string | undefined> {
  const rows = await db
    .select({ valueText: sql<string | null>`${systemSettings.value}::text` })
    .from(systemSettings)
    .where(eq(systemSettings.key, MIN_QUESTIONS_KEY))
    .limit(1);
  return rows[0]?.valueText ?? undefined;
}
