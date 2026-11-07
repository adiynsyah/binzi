"use client";

import {
  useId,
  useImperativeHandle,
  useState,
  type Ref,
} from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import type { Slice } from "@tiptap/pm/model";

import { EditorBlockedPastePanel } from "./editor-blocked-paste";
import { EditorLinkDialog, insertOrSetLink } from "./editor-link-dialog";
import { EditorToolbar } from "./editor-toolbar";
import { createEditorExtensions } from "./editor-extensions";
import { detectBlockedPaste, type BlockedPaste } from "./editor-paste";
import styles from "./rich-text-editor.module.css";
import type { ContentDoc } from "@/lib/content-doc";
import { cn } from "@/lib/utils";

/*
 * RichTextEditor (card S1-03b §3) — the one rich-text editing surface of
 * the CMS. Its extensions whitelist (editor-extensions.ts) guarantees
 * getJSON() always passes the S1-03a validator, so S1-04 can save the
 * onChange payload as-is.
 *
 * Two @tiptap/react 3.32.0 behaviors shape this file:
 * - useEditor does NOT re-render on transactions (toolbar state goes
 *   through useEditorState in EditorToolbar), and it re-applies its
 *   options object on every render — so the canvas attributes are built
 *   from the CURRENT props inside the useEditor call. A separate
 *   editor.setOptions call in an effect would be wiped by the next
 *   re-render (verified 7 Nov).
 * - update fires for transactions that do not change the document (e.g.
 *   the trailing paragraph a focused table-ending document gains), so
 *   onChange filters on transaction.docChanged — otherwise S1-04 would
 *   flag unsaved changes just because the writer clicked the canvas.
 *
 * defaultValue is read ONCE at mount; resetting the field means
 * remounting with a new key.
 *
 * Pasting video/embed content never lands silently: handlePaste (card §7)
 * catches it before the Link plugin turns URLs into links and the 20b
 * panel explains what to do instead (CRS-05).
 */

export type RichTextEditorHandle = { focus: () => void };

/** What handlePaste caught: the detection result plus ProseMirror's parsed
 *  slice, kept for "Tempel tanpa bagian itu" (card §7). */
type BlockedPasteState = {
  result: BlockedPaste;
  slice: Slice;
};

export type RichTextEditorProps = {
  defaultValue: ContentDoc;
  onChange: (doc: JSONContent) => void;
  "aria-labelledby": string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
  className?: string;
  ref?: Ref<RichTextEditorHandle>;
};

export function RichTextEditor({
  defaultValue,
  onChange,
  placeholder,
  className,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ref,
}: RichTextEditorProps) {
  const canvasId = useId();
  // defaultValue is read ONCE (lazy useState initializer) — later prop
  // changes are ignored; resetting the field means remounting with a new
  // key. Built here rather than in an effect so the editor is configured
  // with it on the first render.
  const [initialContent] = useState(
    () => structuredClone(defaultValue) as unknown as JSONContent,
  );
  // Built once per mount — rebuilding per render would reconfigure the
  // editor and drop the document (owner decision).
  const [extensions] = useState(() => createEditorExtensions({ placeholder }));
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  // Bumped on every open; the dialog remounts with a fresh field and no
  // leftover error (instead of resetting state from an effect).
  const [linkDialogKey, setLinkDialogKey] = useState(0);
  const [blockedPaste, setBlockedPaste] = useState<BlockedPasteState | null>(
    null,
  );

  const editor = useEditor({
    // Written explicitly: without it SSR throws; 3.32.0 also forces it
    // under Next.js with a dev warning.
    immediatelyRender: false,
    extensions,
    content: initialContent,
    onUpdate: ({ editor: instance, transaction }) => {
      if (transaction.docChanged) onChange(instance.getJSON());
    },
    editorProps: {
      // Runs BEFORE the Link and prosemirror-tables plugins (card §7), so
      // a video URL is still plain text here and never becomes a link.
      handlePaste: (_view, event, slice) => {
        const clipboard = event.clipboardData;
        const blocked = detectBlockedPaste({
          html: clipboard?.getData("text/html") ?? null,
          text: clipboard?.getData("text/plain") ?? null,
        });
        if (blocked === null) return false;
        // Swallow the paste: the document only changes once the writer
        // picks an action on the 20b panel.
        setBlockedPaste({ result: blocked, slice });
        return true;
      },
      attributes: {
        id: canvasId,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        // Undefined/false keys stay ABSENT — ProseMirror stringifies
        // values it passes through, which would render "undefined".
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(ariaInvalid ? { "aria-invalid": "true" } : {}),
      },
    },
  });

  useImperativeHandle(
    ref,
    () => ({ focus: () => editor?.commands.focus() }),
    [editor],
  );

  function openLinkDialog(): void {
    if (!editor) return;
    const href = editor.getAttributes("link").href;
    const inLink = typeof href === "string";
    setLinkHref(inLink ? href : "");
    if (inLink) {
      // Edit mode: cover the whole link so Simpan/Hapus act on all of
      // it (card §5).
      editor.chain().focus().extendMarkRange("link").run();
    }
    setLinkDialogKey((key) => key + 1);
    setLinkDialogOpen(true);
  }

  /** Every panel exit path lands here: hide it, back to the canvas. */
  function closeBlockedPanel(): void {
    setBlockedPaste(null);
    editor?.commands.focus();
  }

  function insertBlockedAsLink(): void {
    const url =
      blockedPaste?.result.kind === "video-link"
        ? blockedPaste.result.url
        : null;
    closeBlockedPanel();
    if (editor && url !== null) insertOrSetLink(editor, url);
  }

  function pasteWithoutBlocked(): void {
    const slice = blockedPaste?.slice ?? null;
    closeBlockedPanel();
    if (!editor || slice === null) return;
    editor.commands.focus();
    // ProseMirror already dropped the forbidden elements while parsing
    // the paste and normalized colwidth (headless tests), so this slice
    // is the sanitized remainder (card §7).
    const { state, dispatch } = editor.view;
    dispatch(state.tr.replaceSelection(slice).scrollIntoView());
  }

  return (
    // No overflow-hidden: it would clip the frame's focus ring (card §3).
    <div className={cn(styles.frame, "rounded-card border border-border", className)}>
      <EditorToolbar
        editor={editor}
        // aria-controls may only point at a node that exists.
        canvasId={editor ? canvasId : undefined}
        onOpenLinkDialog={openLinkDialog}
      />
      {blockedPaste ? (
        <EditorBlockedPastePanel
          result={blockedPaste.result}
          onInsertAsLink={insertBlockedAsLink}
          onPasteWithoutBlocked={pasteWithoutBlocked}
          onDismiss={closeBlockedPanel}
        />
      ) : null}
      {editor ? (
        <EditorContent editor={editor} className={styles.canvas} />
      ) : (
        // Same padding + minimum height as the canvas, so the frame
        // does not jump when the editor becomes ready.
        <div className={styles.canvasPlaceholder} aria-hidden="true" />
      )}
      <EditorLinkDialog
        key={linkDialogKey}
        editor={editor}
        open={linkDialogOpen}
        initialHref={linkHref}
        onOpenChange={setLinkDialogOpen}
      />
    </div>
  );
}
