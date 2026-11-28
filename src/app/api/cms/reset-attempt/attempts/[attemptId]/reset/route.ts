// POST /api/cms/reset-attempt/attempts/{attemptId}/reset — reset without a
// report (card S3-03 §3, screen 26c). ADMIN first; not a UUID → 404 before
// the service. Answers 200 { data: { attemptId } }.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request-body";
import { UUID_PATTERN } from "@/modules/course/schema";
import { resetAttemptManually } from "@/modules/recovery/service";

const MAX_RESET_BODY_BYTES = 4096;

function isDomainError(error: unknown): boolean {
  return error instanceof ZodError || (isAppError(error) && error.status < 500);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const sessionUser = await requireApiRole("ADMIN", request);
    const { attemptId } = await params;
    if (!UUID_PATTERN.test(attemptId)) {
      throw new NotFoundError("Attempt tidak ditemukan.");
    }
    const body = await readJsonBody(request, MAX_RESET_BODY_BYTES);
    const result = await resetAttemptManually(sessionUser, attemptId, body);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/cms/reset-attempt/attempts/:attemptId/reset]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
