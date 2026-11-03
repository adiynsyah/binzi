// CMS courses API (card S1-01) — the ping-route pattern (A-12): the role
// guard runs BEFORE anything else (guard order, src/modules/README.md),
// including before the request body is parsed; the ORIGINAL error is
// logged before toErrorResponse() (A-08 rule, until Sentry lands) EXCEPT
// domain 4xx errors, which are expected answers and never logged.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { BadRequestError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { createCourse, listCourses } from "@/modules/course/service";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function GET(request: Request) {
  try {
    const actor = await requireApiRole("EDITOR", request);
    const params = new URL(request.url).searchParams;
    const data = await listCourses(actor, {
      status: params.get("status") ?? undefined,
      q: params.get("q") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[GET /api/cms/courses]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiRole("EDITOR", request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      // Malformed JSON is a domain 400 — a body-parsing answer, not a crash.
      throw new BadRequestError("Body permintaan harus JSON valid");
    }

    const course = await createCourse(actor, body);
    return NextResponse.json({ data: course }, { status: 201 });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/cms/courses]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
