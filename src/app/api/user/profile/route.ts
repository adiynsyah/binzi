// PATCH /api/user/profile — the /profil name form (card S5-05 §4.6). The
// body carries { name } ONLY (updateNameInput is a strictObject) and the
// write targets the SESSION user, so no user id ever appears on the wire.
// Route pattern mirrors the enroll route: role FIRST, domain 4xx never
// logged.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAppError, toErrorResponse } from "@/lib/errors";
import { readJsonBody } from "@/lib/request-body";
import { requireApiRole } from "@/lib/rbac";
import { updateMyName } from "@/modules/user/service";

/** One name (≤128 chars) plus JSON overhead — a generous small budget. */
const MAX_PROFILE_BODY_BYTES = 2048;

function isDomainError(error: unknown): boolean {
  return (
    error instanceof ZodError || (isAppError(error) && error.status < 500)
  );
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireApiRole("MEMBER", request);
    const body = await readJsonBody(request, MAX_PROFILE_BODY_BYTES);

    const profile = await updateMyName(sessionUser, body);
    return NextResponse.json({ data: { name: profile.name } }, { status: 200 });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[PATCH /api/user/profile]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
