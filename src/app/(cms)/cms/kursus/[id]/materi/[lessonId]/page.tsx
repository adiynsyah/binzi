// /cms/kursus/[id]/materi/[lessonId] (card S1-04 §5) — the lesson text
// editor, replacing the S1-02 placeholder. Guards as before: EDITOR+,
// both ids UUIDs, and the lesson must belong to that course — anything
// else is a 404 (anti-IDOR shape: existence is not confirmed), same as
// the builder page. A DRAFT course opens ContentDocForm; a non-DRAFT
// course shows the locked view (§7); a stored document that somehow fails
// the validator never opens the editor (§5).
import { notFound } from "next/navigation";

import {
  ContentDocForm,
  CONTENT_DOC_HEADING_CLASS,
} from "@/components/cms/content-doc-form";
import { LOCKED_NOTICE } from "@/components/cms/course-settings-panel";
import { RichContent } from "@/components/shared/rich-content";
import { Banner } from "@/components/ui/banner";
import { isDocEmpty } from "@/lib/content-doc";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { UUID_PATTERN } from "@/modules/course/schema";
import { getLessonEditor, type LessonEditorDTO } from "@/modules/lesson/service";

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

  let editor: LessonEditorDTO;
  try {
    editor = await getLessonEditor(sessionUser, { courseId: id, lessonId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const { course, lesson } = editor;

  if (course.status !== "DRAFT") {
    // Locked view (card §7): no editor, no Simpan — the notice plus the
    // stored text (or "Belum diisi." when it is empty).
    return (
      <div>
        <h1 className={CONTENT_DOC_HEADING_CLASS}>{lesson.title}</h1>
        <div className="mt-4">
          <Banner tone="info" title={LOCKED_NOTICE} />
        </div>
        <div className="mt-6">
          {lesson.content !== null && !isDocEmpty(lesson.content) ? (
            <RichContent doc={lesson.content} />
          ) : (
            <p className="text-[15px] text-text-muted">Belum diisi.</p>
          )}
        </div>
      </div>
    );
  }

  if (lesson.content === null) {
    // The serializer already logged the issue codes + paths — the page
    // never shows the document's text back (§12.3).
    return (
      <div>
        <h1 className={CONTENT_DOC_HEADING_CLASS}>{lesson.title}</h1>
        <p className="mt-4 text-[15px] text-text-muted">
          Isi materi ini tidak bisa dibuka editor.
        </p>
      </div>
    );
  }

  return (
    <ContentDocForm
      initialDoc={lesson.content}
      saveUrl={`/api/cms/courses/${course.id}/lessons/${lesson.id}`}
      method="PATCH"
      bodyKey="content"
      labelId="lesson-content-label"
      breadcrumb={[
        { label: "Kursus", href: "/cms/kursus" },
        { label: course.title, href: `/cms/kursus/${course.id}` },
        { label: `Materi ${lesson.orderIndex}`, href: null },
      ]}
      heading={lesson.title}
    />
  );
}
