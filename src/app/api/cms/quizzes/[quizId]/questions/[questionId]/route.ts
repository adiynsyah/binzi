// PATCH /api/cms/quizzes/{quizId}/questions/{questionId} (card S1-09 §2) —
// save an edited question. Same route pattern as the S1-04 content
// endpoint: role guard BEFORE the body is read (an unauthorized caller
// never makes the server read a large body), non-UUID ids → 404, the body
// runs through the budgeted reader, domain 4xx answers are expected and
// never logged, everything else is logged before toErrorResponse().
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import {
  MAX_QUESTION_BODY_BYTES,
  readJsonBody,
} from "@/lib/request-body";
import { requireApiRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { updateQuestion } from "@/modules/quiz/service";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string }> },
) {
  try {
    // 1. Role before the body is read (card §2).
    const actor = await requireApiRole("EDITOR", request);
    // 2. Both ids must be UUIDs.
    const { quizId, questionId } = await params;
    if (!UUID_PATTERN.test(quizId)) {
      throw new NotFoundError("Quiz tidak ditemukan");
    }
    if (!UUID_PATTERN.test(questionId)) {
      throw new NotFoundError("Soal tidak ditemukan");
    }
    // 3. Budgeted body read: malformed JSON → BadRequestError, over
    //    MAX_QUESTION_BODY_BYTES → PayloadTooLargeError — both 4xx.
    const body = await readJsonBody(request, MAX_QUESTION_BODY_BYTES);
    // 4. Service.
    const dto = await updateQuestion(
      actor,
      { quizId, questionId },
      body,
    );
    return NextResponse.json({ data: dto });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error(
        "[PATCH /api/cms/quizzes/:quizId/questions/:questionId]",
        error,
      );
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
