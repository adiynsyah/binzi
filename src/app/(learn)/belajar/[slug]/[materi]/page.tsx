// /belajar/{kursus}/{materi} — the member lesson page (card S2-01 §4).
// This file is the data wire only: layered guard → getLessonPage →
// <LessonPage>. A NotFoundError becomes notFound() (the anti-IDOR 404:
// unknown/unpublished course, unknown lesson, another course's lesson);
// anything else bubbles up — a 500 is the honest answer for those.
//
// NO loading.tsx exists here or in belajar/[slug]/ (owner decision 7, the
// 11 Nov sandbox finding): the fallback would convert notFound()/redirect()
// answers into 200s. src/lib/learn-route-structure.test.ts guards it.
import { notFound } from "next/navigation";

import { LessonPage } from "@/components/learn/lesson-page";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { getLessonPage, type LessonPageDTO } from "@/modules/progress/service";

export default async function LessonMaterialPage({
  params,
}: {
  params: Promise<{ slug: string; materi: string }>;
}) {
  const actor = await requireRole("MEMBER");
  const { slug, materi } = await params;

  let data: LessonPageDTO;
  try {
    data = await getLessonPage(actor, slug, materi);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return <LessonPage data={data} />;
}
