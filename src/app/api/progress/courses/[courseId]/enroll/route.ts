// POST /api/progress/courses/{courseId}/enroll — implicit enrollment behind
// "Mulai materi 1" (card S5-01 §1). Route layer mirrors the service guard
// (role FIRST, then the id), keeps every miss a 404, and answers 201 for a
// new enrollment / 200 when already enrolled (idempotent double-click).
// Same route pattern as the CMS publish route: domain 4xx never logged.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { enrollInCourse } from "@/modules/progress/service";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const sessionUser = await requireApiRole("MEMBER", request);
    const { courseId } = await params;
    if (!UUID_PATTERN.test(courseId)) {
      throw new NotFoundError("Kursus tidak ditemukan.");
    }

    const { created, data } = await enrollInCourse(sessionUser, courseId);
    return NextResponse.json({ data }, { status: created ? 201 : 200 });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/progress/courses/:courseId/enroll]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
