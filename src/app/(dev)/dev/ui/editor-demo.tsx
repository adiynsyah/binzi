"use client";

import { useId, useState } from "react";
import type { JSONContent } from "@tiptap/react";

import { RichTextEditor } from "@/components/cms/rich-text-editor";
import { RichContent } from "@/components/shared/rich-content";
import { EMPTY_DOC } from "@/lib/content-doc";
import { CONTENT_DOC_SHOWCASE } from "@/lib/content-doc-fixtures";
import { validateContentDoc } from "@/lib/content-doc-validator";

/*
 * /dev/ui "Editor teks" section (card S1-03b §8) — the owner's
 * verification tool: paste from Google Docs or Word into the showcase
 * editor, then watch the validator status and the participant-side
 * rendering of the SAME output. The placeholder default ("Mulai menulis…")
 * comes from createEditorExtensions.
 */

const CAPTION_CLASS =
  "mb-3 font-mono text-xs uppercase tracking-wide text-text-subtle";

export function EditorDemo() {
  const showcaseLabelId = useId();
  const placeholderLabelId = useId();
  // Null until the first edit — the status and the preview then report
  // the source document, the same one the editor loaded.
  const [editedDoc, setEditedDoc] = useState<JSONContent | null>(null);
  const reported = editedDoc ?? CONTENT_DOC_SHOWCASE;
  const result = validateContentDoc(reported);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p id={showcaseLabelId} className={CAPTION_CLASS}>
          Editor dengan showcase — tempel dari Google Docs atau Word di sini
        </p>
        <RichTextEditor
          defaultValue={CONTENT_DOC_SHOWCASE}
          onChange={setEditedDoc}
          aria-labelledby={showcaseLabelId}
        />
      </div>
      <div>
        <p className={CAPTION_CLASS}>Validator atas keluaran terakhir</p>
        {result.ok ? (
          <p className="text-sm font-bold text-success">Dokumen sah</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {result.issues.map((issue) => (
              <li
                key={`${issue.code}:${issue.path.join("/")}`}
                className="font-mono text-xs text-danger"
              >
                {issue.code} · /{issue.path.join("/")}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className={CAPTION_CLASS}>
          Sisi peserta — RichContent atas keluaran yang sama
        </p>
        <RichContent doc={reported} />
      </div>
      <div>
        <p id={placeholderLabelId} className={CAPTION_CLASS}>
          Editor kosong — placeholder
        </p>
        <RichTextEditor
          defaultValue={EMPTY_DOC}
          onChange={() => {}}
          aria-labelledby={placeholderLabelId}
        />
      </div>
    </div>
  );
}
