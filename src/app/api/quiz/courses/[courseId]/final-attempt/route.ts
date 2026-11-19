// POST /api/quiz/courses/{courseId}/final-attempt — "mulai Final Quiz"
// (card S5-02 §3). Role first, then the route param through the shared Zod
// contract (a non-UUID answers 400). Answers 201 { data: { attemptId,
// created: true } } for the one attempt and 200 with created:false when the
// index guard continued an IN_PROGRESS one (QZ-08); 409 when the gate (not
// all lessons COMPLETED) or the one-attempt rule (already SUBMITTED /
// EXPIRED) says no; 404 for unknown course / not enrolled — uniform, no
// existence leaks (anti-IDOR).
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { startFinalQuizInput } from "@/modules/attempt/schema";
import { startFinalQuiz } from "@/modules/attempt/service";

function isDomainError(error: unknown): boolean {
  return error instanceof ZodError || (isAppError(error) && error.status < 500);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const sessionUser = await requireApiRole("MEMBER", request);
    const { courseId } = await params;
    const input = startFinalQuizInput.parse({ courseId });
    const { attemptId, created } = await startFinalQuiz(sessionUser, input);
    return NextResponse.json(
      { data: { attemptId, created } },
      { status: created ? 201 : 200 },
    );
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/quiz/courses/:courseId/final-attempt]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
