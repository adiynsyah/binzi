// POST /api/cms/courses/{id}/publish (card S1-08 §2) — Setujui & terbitkan.
// Same route pattern as the builder PATCH: role guard first, non-UUID id →
// 404, domain 4xx never logged, everything else logged before
// toErrorResponse(). No body is read.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { publishCourse } from "@/modules/course/service";
import { UUID_PATTERN } from "@/modules/course/schema";

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
    const actor = await requireApiRole("ADMIN", request);
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }

    const course = await publishCourse(actor, id);
    return NextResponse.json({ data: course });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/cms/courses/:id/publish]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
