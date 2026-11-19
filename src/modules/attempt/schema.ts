// Input contracts for the attempt module (card S3-01 §1) — pure Zod, no
// server imports, so client bundles may reuse them. strictObject at every
// level: unknown keys are rejected, never stripped.
//
// The card pins ALL four ids to z.uuid() (lessonId, attemptId, questionId,
// optionId) — unlike the progress module's UUID_PATTERN rule, accepted with
// this card. A non-UUID therefore answers 400 here, before any 404.
import { z } from "zod";

/** POST /api/quiz/lessons/{lessonId}/attempt — the route param is the body. */
export const startQuizInput = z.strictObject({
  lessonId: z.uuid(),
});

/** PUT …/answers/{questionId} — the JSON body is exactly one option id. */
export const saveQuizAnswerBody = z.strictObject({
  optionId: z.uuid(),
});

/** The merged save contract (params + body) the service parses. */
export const saveQuizAnswerInput = z.strictObject({
  attemptId: z.uuid(),
  questionId: z.uuid(),
  optionId: z.uuid(),
});

/** POST /api/quiz/attempts/{attemptId}/submit — the route param is the body. */
export const submitQuizInput = z.strictObject({
  attemptId: z.uuid(),
});

export type StartQuizInput = z.infer<typeof startQuizInput>;
export type SaveQuizAnswerBody = z.infer<typeof saveQuizAnswerBody>;
export type SaveQuizAnswerInput = z.infer<typeof saveQuizAnswerInput>;
export type SubmitQuizInput = z.infer<typeof submitQuizInput>;
