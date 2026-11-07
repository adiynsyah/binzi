// PUT /api/cms/courses/{id}/description (card S1-04 §3) — save the course
// description. A SEPARATE endpoint from PATCH /api/cms/courses/{id}: the
// five-field settings contract stays untouched and a long document never
// rides along on every settings save. Route pattern as S1-02: role guard
// BEFORE the body is read, non-UUID id → 404 (never a 500 from Postgres),
// the body runs through the budgeted reader (malformed JSON → 400, over
// 1 MiB → 413 — both domain answers, never logged), domain 4xx answers
// are expected and never logged, everything else is logged before
// toErrorResponse() (A-08 rule, until Sentry lands).
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { readJsonBody, MAX_CONTENT_BODY_BYTES } from "@/lib/request-body";
import { requireApiRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { updateCourseDescription } from "@/modules/course/service";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Role before the body is read (card §3 step 1).
    const actor = await requireApiRole("EDITOR", request);
    // 2. The id must be a UUID.
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }
    // 3. Budgeted body read: malformed JSON → BadRequestError, over
    //    MAX_CONTENT_BODY_BYTES → PayloadTooLargeError — both 4xx.
    const body = await readJsonBody(request, MAX_CONTENT_BODY_BYTES);
    // 4. Service.
    const dto = await updateCourseDescription(actor, id, body);
    return NextResponse.json({ data: dto });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[PUT /api/cms/courses/:id/description]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
