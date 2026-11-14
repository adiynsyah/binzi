// POST /api/progress/video — save the video position (card S2-01 §3,
// permanent groundwork for the S2-02 player: called every 10 s, on pause,
// and on end). Role first, then the 4096-byte body, then the shared Zod
// contract. Answers 200 { data: { positionSeconds, watchedPercent } } with
// the STORED values. Same error pattern as the enroll route.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAppError, toErrorResponse } from "@/lib/errors";
import { readJsonBody } from "@/lib/request-body";
import { requireApiRole } from "@/lib/rbac";
import { videoProgressInput } from "@/modules/progress/schema";
import { recordVideoProgress } from "@/modules/progress/service";

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function POST(request: Request) {
  try {
    const sessionUser = await requireApiRole("MEMBER", request);
    const body = await readJsonBody(request, 4096);
    const input = videoProgressInput.parse(body);
    const data = await recordVideoProgress(sessionUser, input);
    return NextResponse.json({ data });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/progress/video]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
