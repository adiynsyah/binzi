// /belajar/{kursus} — the course progress page (card S5-04 §2). Data wire
// only, mirroring the final-quiz page: guard → the two reads in ONE
// Promise.all (the page + the score weights, which arrive as PROPS — this
// route never touches the quiz module's queries) → <CourseProgress>.
//
// A NotFoundError becomes notFound() (the anti-IDOR 404: unknown slug,
// unpublished course, course without lessons — enrolled or not); anything
// else bubbles up. The `kembali` state (not enrolled) redirects to the
// first lesson, which enrolls on open. NO loading.tsx in [slug]/ (card
// §2): a fallback would convert notFound()/redirect() answers into 200s —
// src/lib/learn-route-structure.test.ts guards it. The static segments
// `nilai`, `kursus-saya`, and `final-quiz` (a folder) win over [slug];
// those slugs are already rejected by the CMS schemas.
import { notFound, redirect } from "next/navigation";

import { PageContainer } from "@/components/shared/page-container";
import { CourseProgress } from "@/components/learn/course-progress";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { getCourseProgressPage } from "@/modules/progress/service";
import { getScoreWeights } from "@/modules/quiz/service";

export default async function CourseProgressRoutePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const actor = await requireRole("MEMBER");
  const { slug } = await params;

  const [page, weights] = await Promise.all([
    getCourseProgressPage(actor, slug),
    getScoreWeights(),
  ]).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  if (page.state === "kembali") redirect(page.href);
  return (
    <PageContainer className="pt-8">
      <CourseProgress progres={page} weights={weights} />
    </PageContainer>
  );
}
