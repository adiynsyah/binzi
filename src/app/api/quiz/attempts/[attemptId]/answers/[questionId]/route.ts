// PUT /api/quiz/attempts/{attemptId}/answers/{questionId} — quiz auto-save
// (card S3-01 §2, QZ-09): fired on every answer change by the client's
// save queue. Role first, then the params + the 1024-byte body through the
// shared Zod contracts (non-UUID ids answer 400). Answers 200 with the
// server clock's savedAt; 409 means finalized or past the 15-second
// tolerance — the client stops saving and submits.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAppError, toErrorResponse } from "@/lib/errors";
import { readJsonBody } from "@/lib/request-body";
import { requireApiRole } from "@/lib/rbac";
import {
  saveQuizAnswerBody,
  saveQuizAnswerInput,
} from "@/modules/attempt/schema";
import { saveQuizAnswer } from "@/modules/attempt/service";

function isDomainError(error: unknown): boolean {
  return error instanceof ZodError || (isAppError(error) && error.status < 500);
}

export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ attemptId: string; questionId: string }> },
) {
  try {
    const sessionUser = await requireApiRole("MEMBER", request);
    const { attemptId, questionId } = await params;
    const body = await readJsonBody(request, 1024);
    const input = saveQuizAnswerInput.parse({
      attemptId,
      questionId,
      ...saveQuizAnswerBody.parse(body),
    });
    const { savedAt } = await saveQuizAnswer(sessionUser, input);
    return NextResponse.json({ data: { savedAt } });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error(
        "[PUT /api/quiz/attempts/:attemptId/answers/:questionId]",
        error,
      );
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
