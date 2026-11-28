// /belajar/{kursus}/{materi}/quiz/laporan — "Laporkan gangguan" for a
// lesson quiz (card S3-03 §5, screens 7i / 7l). Data wire only: guard →
// getAttemptReportPage → <AttemptReport>. NotFoundError → notFound() (the
// uniform 404); `{ redirect }` → redirect() back to the quiz page, which
// owns the states this page does not (no attempt yet, still running, a
// manual reset not redone yet, a locked lesson).
//
// NO loading.tsx here (S2-01 sandbox finding): a fallback would turn
// notFound()/redirect() into 200s. src/lib/learn-route-structure.test.ts
// guards it.
import { notFound, redirect } from "next/navigation";

import { AttemptReport } from "@/components/learn/quiz/attempt-report";
import { PageContainer } from "@/components/shared/page-container";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  getAttemptReportPage,
  type AttemptReportPageDTO,
} from "@/modules/recovery/service";

export default async function LessonQuizReportPage({
  params,
}: {
  params: Promise<{ slug: string; materi: string }>;
}) {
  const actor = await requireRole("MEMBER");
  const { slug, materi } = await params;

  let data: AttemptReportPageDTO | { redirect: string };
  try {
    data = await getAttemptReportPage(actor, {
      kind: "LESSON",
      courseSlug: slug,
      lessonSlug: materi,
    });
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
