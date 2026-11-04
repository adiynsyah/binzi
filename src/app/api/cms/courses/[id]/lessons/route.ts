// POST /api/cms/courses/{id}/lessons (card S1-02 §4) — "Tambah materi"
// (21h). Same route pattern as S1-01: role guard BEFORE the body is
// parsed, non-UUID id → 404, domain 4xx never logged, the rest logged
// before toErrorResponse().
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { BadRequestError, NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { createLesson } from "@/modules/lesson/service";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function POST(
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
      throw new BadRequestError("Body permintaan harus JSON valid");
    }

    const lesson = await createLesson(actor, id, body);
    return NextResponse.json({ data: lesson }, { status: 201 });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/cms/courses/:id/lessons]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
