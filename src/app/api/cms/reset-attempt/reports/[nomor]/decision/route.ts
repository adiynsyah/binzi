// POST /api/cms/reset-attempt/reports/{nomor}/decision — approve (reset) or
// reject a PENDING report (card S3-03 §3, screen 26b). ADMIN first; a
// `nomor` that is not a positive 32-bit integer → 404 before the service.
// Answers 200 { data: { status } }.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NotFoundError, isAppError, toErrorResponse } from "@/lib/errors";
import { requireApiRole } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request-body";
import { decideAttemptReport } from "@/modules/recovery/service";

const MAX_DECISION_BODY_BYTES = 4096;
const REPORT_NUMBER_PATTERN = /^[1-9]\d{0,9}$/;

function isDomainError(error: unknown): boolean {
  return error instanceof ZodError || (isAppError(error) && error.status < 500);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ nomor: string }> },
) {
  try {
    const sessionUser = await requireApiRole("ADMIN", request);
    const { nomor } = await params;
    const number = Number(nomor);
    if (!REPORT_NUMBER_PATTERN.test(nomor) || number > 2_147_483_647) {
      throw new NotFoundError("Laporan tidak ditemukan.");
    }
    const body = await readJsonBody(request, MAX_DECISION_BODY_BYTES);
    const result = await decideAttemptReport(sessionUser, number, body);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (!isDomainError(error)) {
      console.error("[POST /api/cms/reset-attempt/reports/:nomor/decision]", error);
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
