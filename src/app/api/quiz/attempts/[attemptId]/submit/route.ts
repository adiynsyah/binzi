// POST /api/quiz/attempts/{attemptId}/submit — "kumpulkan" (card S3-01 §2),
// also the expiry beacon's target (28c: when the timer hits zero the client
// sends pending answers, then this). Role first, then the route param
// through the shared Zod contract. Answers 200 { data: { status } } —
// SUBMITTED or EXPIRED per the server clock — and is IDEMPOTENT: a repeat
// on an already-final attempt returns the stored status, never regrades.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { submitQuizInput } from "@/modules/attempt/schema";
import { submitQuizAttempt } from "@/modules/attempt/service";

function isDomainError(error: unknown): boolean {
  return error instanceof ZodError || (isAppError(error) && error.status < 500);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const sessionUser = await requireApiRole("MEMBER", request);
    const { attemptId } = await params;
    const input = submitQuizInput.parse({ attemptId });
    const result = await submitQuizAttempt(sessionUser, input);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/quiz/attempts/:attemptId/submit]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
