// /cms/kursus/[id]/materi/[lessonId] (card S1-02 §4): a PLACEHOLDER for
// the lesson editor — the editor itself is S1-04. Both ids must be UUIDs
// and the lesson must belong to that course; anything else is a 404
// (anti-IDOR shape: existence is not confirmed), same as the builder page.
import { notFound } from "next/navigation";

import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { getLessonInCourse } from "@/modules/lesson/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CmsLessonEditorPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  // Matrix: /cms/kursus (prefix) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const { id, lessonId } = await params;

  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(lessonId)) {
    notFound();
  }

  let lesson: { id: string; title: string };
  try {
    lesson = await getLessonInCourse(sessionUser, { courseId: id, lessonId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return <CmsPlaceholderPage title={lesson.title} />;
}
