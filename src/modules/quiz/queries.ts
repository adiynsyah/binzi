// Database access for the quiz domain (card S1-01).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
import "server-only";

import type { Db } from "@/db/client";
import { quizzes } from "@/db/schema";

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
