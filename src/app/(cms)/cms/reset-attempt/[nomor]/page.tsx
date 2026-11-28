// /cms/reset-attempt/{nomor} (card S3-03 §6, screen 26b): review one report
// and decide. `nomor` that is not a positive 32-bit integer, or an unknown
// number → notFound(). ADMIN+ here and inside the service. No loading.tsx
// (decision 14).
import { notFound } from "next/navigation";

import { ResetAttemptReview } from "@/components/cms/reset-attempt-review";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  getAttemptReportReview,
  type ReportReviewDTO,
} from "@/modules/recovery/service";

const REPORT_NUMBER_PATTERN = /^[1-9]\d{0,9}$/;

export default async function CmsResetAttemptReviewPage({
  params,
}: {
  params: Promise<{ nomor: string }>;
}) {
  // Matrix: /cms/reset-attempt (prefix) → ADMIN+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("ADMIN");
  const { nomor } = await params;
  const number = Number(nomor);
  if (!REPORT_NUMBER_PATTERN.test(nomor) || number > 2_147_483_647) notFound();

  let data: ReportReviewDTO;
  try {
    data = await getAttemptReportReview(sessionUser, number);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return <ResetAttemptReview data={data} />;
}
