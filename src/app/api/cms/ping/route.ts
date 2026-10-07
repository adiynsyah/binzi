// Example CMS endpoint (card A-12): proves /api/cms/* answers 401 (no
// session) / 403 (role too low) as JSON — never a redirect — and 200 for
// EDITOR+. The role check runs BEFORE anything else (guard order,
// src/modules/README.md).
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    await requireApiRole("EDITOR", request);
    return NextResponse.json({ data: { message: "pong" } });
  } catch (error) {
    // Report the original error before the generic response (A-08 rule).
    console.error("[GET /api/cms/ping]", error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
