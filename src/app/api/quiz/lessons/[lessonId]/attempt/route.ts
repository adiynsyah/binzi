// POST /api/quiz/lessons/{lessonId}/attempt — "mulai quiz" (card S3-01 §2).
// Role first, then the route param through the shared Zod contract (a
// non-UUID answers 400 here — the card pins z.uuid() for all four ids).
// Answers 201 { data: { attemptId, created: true } } for a new attempt and
// 200 with created:false when the index guard continued an IN_PROGRESS one
// (a double-click or refresh — QZ-08, never a second attempt).
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { startQuizInput } from "@/modules/attempt/schema";
import { startLessonQuiz } from "@/modules/attempt/service";

function isDomainError(error: unknown): boolean {
  return error instanceof ZodError || (isAppError(error) && error.status < 500);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  try {
    const sessionUser = await requireApiRole("MEMBER", request);
    const { lessonId } = await params;
    const input = startQuizInput.parse({ lessonId });
    const { attemptId, created } = await startLessonQuiz(sessionUser, input);
    return NextResponse.json(
      { data: { attemptId, created } },
      { status: created ? 201 : 200 },
    );
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/quiz/lessons/:lessonId/attempt]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
