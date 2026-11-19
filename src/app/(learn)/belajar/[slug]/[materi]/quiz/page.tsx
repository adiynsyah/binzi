// /belajar/{kursus}/{materi}/quiz — the quiz page (card S3-01 §4).
// This file is the data wire only, mirroring the lesson page: layered
// guard → getLessonQuizPage → <QuizPage>. A NotFoundError becomes
// notFound() (the anti-IDOR 404: unknown/unpublished course, unknown
// lesson, another course's lesson, or a lesson without a quiz); anything
// else bubbles up — a 500 is the honest answer for those. The `kembali`
// state (locked lesson / video gate not met) redirects to the lesson
// page, which renders both properly.
//
// NO loading.tsx here (card §5; the S2-01 sandbox finding): a fallback
// would convert notFound()/redirect() answers into 200s.
// src/lib/learn-route-structure.test.ts guards it.
import { notFound, redirect } from "next/navigation";

import { QuizPage } from "@/components/learn/quiz/quiz-page";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { getLessonQuizPage, type LessonQuizPageDTO } from "@/modules/attempt/service";

export default async function LessonQuizPage({
  params,
}: {
  params: Promise<{ slug: string; materi: string }>;
}) {
  const actor = await requireRole("MEMBER");
  const { slug, materi } = await params;

  let data: LessonQuizPageDTO;
  try {
    data = await getLessonQuizPage(actor, slug, materi);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  if (data.state === "kembali") redirect(data.href);
  return <QuizPage data={data} />;
}
