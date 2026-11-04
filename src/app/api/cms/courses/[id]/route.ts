// PATCH /api/cms/courses/{id} (card S1-02 §2) — the builder settings form.
// Same route pattern as /api/cms/courses (S1-01): role guard BEFORE the
// body is parsed, non-UUID id → 404 (never a 500 from Postgres), domain
// 4xx answers are expected and never logged, everything else is logged
// before toErrorResponse() (A-08 rule, until Sentry lands).
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { BadRequestError, NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { updateCourse } from "@/modules/course/service";
import { UUID_PATTERN } from "@/modules/course/schema";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiRole("EDITOR", request);
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      // Malformed JSON is a domain 400 — a body-parsing answer, not a crash.
      throw new BadRequestError("Body permintaan harus JSON valid");
    }

    const course = await updateCourse(actor, id, body);
    return NextResponse.json({ data: course });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[PATCH /api/cms/courses/:id]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
