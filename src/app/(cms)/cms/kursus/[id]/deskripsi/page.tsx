// /cms/kursus/[id]/deskripsi (card S1-04 §6) — the course description
// editor, on its own page (owner decision 4 Nov: the document is long —
// toolbar, tables, link dialog — so no nested dialogs on the builder).
// Guards as the builder page: EDITOR+, UUID id, unknown course → 404
// (anti-IDOR shape). A DRAFT course opens ContentDocForm; non-DRAFT
// shows the locked view (§7). A stored description that somehow fails
// the validator never opens the editor.
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
import {
  getCourseDescriptionEditor,
  type CourseDescriptionEditorDTO,
} from "@/modules/course/service";

// Agent copy (card §6 usulan; the design has not drawn this page) — listed
// in the PR.
const DESCRIPTION_INTRO =
  "Tampil di halaman kursus, di bawah ringkasan. Ceritakan untuk siapa kursus ini dan apa yang akan dipelajari.";
// Derived from the lesson page's equivalent (card §5) — listed in the PR.
const UNREADABLE_DESCRIPTION = "Deskripsi ini tidak bisa dibuka editor.";

export default async function CmsCourseDescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Matrix: /cms/kursus (prefix) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  let editor: CourseDescriptionEditorDTO;
  try {
    editor = await getCourseDescriptionEditor(sessionUser, { courseId: id });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  if (editor.status !== "DRAFT") {
    // Locked view (card §7): notice + the stored text (or "Belum diisi.").
    return (
      <div>
        <h1 className={CONTENT_DOC_HEADING_CLASS}>Deskripsi lengkap</h1>
        <div className="mt-4">
          <Banner tone="info" title={LOCKED_NOTICE} />
        </div>
        <div className="mt-6">
          {editor.description !== null && !isDocEmpty(editor.description) ? (
            <RichContent doc={editor.description} />
          ) : (
            <p className="text-[15px] text-text-muted">Belum diisi.</p>
          )}
        </div>
      </div>
    );
  }

  if (editor.description === null) {
    return (
      <div>
        <h1 className={CONTENT_DOC_HEADING_CLASS}>Deskripsi lengkap</h1>
        <p className="mt-4 text-[15px] text-text-muted">
          {UNREADABLE_DESCRIPTION}
        </p>
      </div>
    );
  }

  return (
    <ContentDocForm
      initialDoc={editor.description}
      saveUrl={`/api/cms/courses/${editor.id}/description`}
      method="PUT"
      bodyKey="description"
      labelId="course-description-label"
      breadcrumb={[
        { label: "Kursus", href: "/cms/kursus" },
        { label: editor.title, href: `/cms/kursus/${editor.id}` },
        { label: "Deskripsi", href: null },
      ]}
      heading="Deskripsi lengkap"
      intro={DESCRIPTION_INTRO}
    />
  );
}
