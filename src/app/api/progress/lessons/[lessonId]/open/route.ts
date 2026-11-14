// POST /api/progress/lessons/{lessonId}/open — "materi dibuka" (card S2-01
// §2). Fired by the client LessonOpenBeacon AFTER the page rendered, never
// on GET (a prefetched link must not mark a lesson opened). Route layer
// mirrors the service guard (role FIRST, then the id); same route pattern
// as the S5-01 enroll route: domain 4xx never logged, answers 204, no body.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { openLesson } from "@/modules/progress/service";

function isDomainError(error: unknown): boolean {
  return error instanceof ZodError || (isAppError(error) && error.status < 500);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  try {
    const sessionUser = await requireApiRole("MEMBER", request);
    const { lessonId } = await params;
    if (!UUID_PATTERN.test(lessonId)) {
      throw new NotFoundError("Materi tidak ditemukan.");
    }

    await openLesson(sessionUser, lessonId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/progress/lessons/:lessonId/open]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
