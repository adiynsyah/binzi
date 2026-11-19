// /belajar/{kursus}/final-quiz — the Final Quiz page (card S5-02 §4).
// Data wire only, mirroring the lesson quiz page: guard → getFinalQuizPage
// → <FinalQuizPage>. A NotFoundError becomes notFound() (the anti-IDOR 404:
// unknown/unpublished course, course without a Final Quiz); anything else
// bubbles up — a 500 is the honest answer for those. The `kembali` state
// (not enrolled / gate unmet without an attempt) redirects to the lesson
// page, which renders the "Mulai materi"/next-step panel.
//
// NO loading.tsx here (card §6; the S2-01 sandbox finding): a fallback
// would convert notFound()/redirect() answers into 200s.
// src/lib/learn-route-structure.test.ts guards it. The static segment
// `final-quiz` wins over [materi]; a lesson slug "final-quiz" is already
// rejected (lesson/queries.ts).
import { notFound, redirect } from "next/navigation";

import { FinalQuizPage } from "@/components/learn/quiz/final-quiz-page";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  getFinalQuizPage,
  type FinalQuizPageDTO,
} from "@/modules/attempt/service";

export default async function FinalQuizRoutePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const actor = await requireRole("MEMBER");
  const { slug } = await params;

  let data: FinalQuizPageDTO;
  try {
    data = await getFinalQuizPage(actor, slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  if (data.state === "kembali") redirect(data.href);
  return <FinalQuizPage data={data} />;
}
