// POST /api/cms/quizzes/{quizId}/questions (card S1-09 §2) — save a new
// question. Same route pattern as the S1-04 content endpoint: role guard
// BEFORE the body is read (an unauthorized caller never makes the server
// read a large body — M8), non-UUID id → 404 (never a 500 from Postgres),
// the body runs through the budgeted reader (malformed JSON → 400, over
// 64 KiB → 413), domain 4xx answers are expected and never logged,
// everything else is logged before toErrorResponse() (A-08 rule).
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import {
  MAX_QUESTION_BODY_BYTES,
  readJsonBody,
} from "@/lib/request-body";
import { requireApiRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { createQuestion } from "@/modules/quiz/service";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  try {
    // 1. Role before the body is read (card §2).
    const actor = await requireApiRole("EDITOR", request);
    // 2. The id must be a UUID.
    const { quizId } = await params;
    if (!UUID_PATTERN.test(quizId)) {
      throw new NotFoundError("Quiz tidak ditemukan");
    }
    // 3. Budgeted body read: malformed JSON → BadRequestError, over
    //    MAX_QUESTION_BODY_BYTES → PayloadTooLargeError — both 4xx.
    const body = await readJsonBody(request, MAX_QUESTION_BODY_BYTES);
    // 4. Service.
    const dto = await createQuestion(actor, { quizId }, body);
    return NextResponse.json({ data: dto }, { status: 201 });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/cms/quizzes/:quizId/questions]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
