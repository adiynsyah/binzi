// /cms/quiz/{quizId} (card S1-09 §3): the quiz question editor, shared by
// FINAL and lesson quizzes. EDITOR+ (the quiz rules page is staff-only);
// a non-UUID id or a quiz without an owning course → 404.
import { notFound } from "next/navigation";

import { QuizEditor } from "@/components/cms/quiz-editor";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { getQuizEditor } from "@/modules/quiz/service";

export default async function CmsQuizEditorPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const sessionUser = await requireRole("EDITOR");
  const { quizId } = await params;
  if (!UUID_PATTERN.test(quizId)) {
    notFound();
  }

  let editor;
  try {
    editor = await getQuizEditor(sessionUser, { quizId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return <QuizEditor editor={editor} />;
}
