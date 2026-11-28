// /belajar/{kursus}/final-quiz/laporan — "Laporkan gangguan" for the Final
// Quiz (card S3-03 §5). Same wire as the lesson-quiz report page: guard →
// getAttemptReportPage → <AttemptReport>; NotFoundError → notFound();
// `{ redirect }` → the Final Quiz page.
//
// NO loading.tsx here (S2-01 sandbox finding) — guarded by
// src/lib/learn-route-structure.test.ts.
import { notFound, redirect } from "next/navigation";

import { AttemptReport } from "@/components/learn/quiz/attempt-report";
import { PageContainer } from "@/components/shared/page-container";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  getAttemptReportPage,
  type AttemptReportPageDTO,
} from "@/modules/recovery/service";

export default async function FinalQuizReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const actor = await requireRole("MEMBER");
  const { slug } = await params;

  let data: AttemptReportPageDTO | { redirect: string };
  try {
    data = await getAttemptReportPage(actor, { kind: "FINAL", courseSlug: slug });
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  if ("redirect" in data) redirect(data.redirect);
  return (
    <PageContainer className="pt-6 pb-12">
      <AttemptReport data={data} />
    </PageContainer>
  );
}
