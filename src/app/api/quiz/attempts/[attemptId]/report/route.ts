// POST /api/quiz/attempts/{attemptId}/report — "Kirim laporan" (card S3-03
// §3, screen 7i). Submit-route pattern: role first, then the route param
// (not a UUID → 404 before the service), then a small body budget. Answers
// 201 { data: { number } }; domain errors (404 not yours / 409 not
// reportable) are not logged.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request-body";
import { UUID_PATTERN } from "@/modules/course/schema";
import { createAttemptReport } from "@/modules/recovery/service";

const MAX_REPORT_BODY_BYTES = 4096;

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
    if (!UUID_PATTERN.test(attemptId)) {
      throw new NotFoundError("Quiz tidak ditemukan.");
    }
    const body = await readJsonBody(request, MAX_REPORT_BODY_BYTES);
    const result = await createAttemptReport(sessionUser, attemptId, body);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/quiz/attempts/:attemptId/report]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
