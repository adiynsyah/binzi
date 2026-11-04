// The ONLY public door of the quiz module (card S1-01). For now it exposes
// exactly one cross-module helper: the empty FINAL quiz created in the SAME
// transaction as its course (src/modules/course/queries.ts calls this with
// its tx handle). Keeping the quizzes column knowledge here — instead of an
// insert inside the course module — gives the defaults one home when the S3
// quiz editor arrives, while the module-boundary rule (communication via
// service.ts, never queries.ts) stays intact.
import { insertEmptyFinalQuiz, type DbTx } from "./queries";

export type { DbTx };

/** Create the course's empty FINAL quiz inside the caller's transaction. */
export async function createEmptyFinalQuiz(tx: DbTx): Promise<{ id: string }> {
  return insertEmptyFinalQuiz(tx);
}
