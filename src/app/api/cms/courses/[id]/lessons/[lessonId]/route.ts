// PATCH /api/cms/courses/{id}/lessons/{lessonId} (card S1-04 §2) — save
// the lesson text. Same route pattern as /api/cms/courses/{id} (S1-02):
// role guard BEFORE the body is read (an unauthorized caller never makes
// the server read a large body), non-UUID ids → 404 (never a 500 from
// Postgres), the body runs through the budgeted reader (malformed JSON →
// 400, over 1 MiB → 413 — both domain answers, never logged), domain 4xx
// answers are expected and never logged, everything else is logged before
// toErrorResponse() (A-08 rule, until Sentry lands).
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { readJsonBody, MAX_CONTENT_BODY_BYTES } from "@/lib/request-body";
import { requireApiRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { updateLessonContent } from "@/modules/lesson/service";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> },
) {
  try {
    // 1. Role before the body is read (card §2 step 1).
    const actor = await requireApiRole("EDITOR", request);
    // 2. Both ids must be UUIDs.
    const { id, lessonId } = await params;
    if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(lessonId)) {
      throw new NotFoundError("Materi tidak ditemukan");
    }
    // 3. Budgeted body read: malformed JSON → BadRequestError, over
    //    MAX_CONTENT_BODY_BYTES → PayloadTooLargeError — both 4xx.
    const body = await readJsonBody(request, MAX_CONTENT_BODY_BYTES);
    // 4. Service.
    const dto = await updateLessonContent(
      actor,
      { courseId: id, lessonId },
      body,
    );
    return NextResponse.json({ data: dto });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[PATCH /api/cms/courses/:id/lessons/:lessonId]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
