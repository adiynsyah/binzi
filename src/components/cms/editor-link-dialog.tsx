"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { classifyHref, CONTENT_DOC_MESSAGES } from "@/lib/content-doc-validator";

/*
 * Link dialog (card S1-03b §5). The component above already extended the
 * selection over the whole link when the dialog was opened from inside
 * one, so "Simpan" only needs setLink on the selection and "Hapus
 * tautan" only needs unsetLink.
 *
 * Validation reuses classifyHref from the S1-03a validator — the same
 * rule the server enforces on save — and shows its INVALID_LINK message
 * with the input flagged aria-invalid, focus staying in the field.
 */

export type EditorLinkDialogProps = {
  editor: Editor | null;
  open: boolean;
  /** href under the cursor; "" = create mode ("Pasang tautan"). */
  initialHref: string;
  onOpenChange: (open: boolean) => void;
};

export function EditorLinkDialog({
  editor,
  open,
  initialHref,
  onOpenChange,
}: EditorLinkDialogProps) {
  const editing = initialHref !== "";
  // The parent remounts this dialog (key) on every open, so the initial
  // state below is a fresh field each time — no reset effect needed.
  const [value, setValue] = useState(initialHref);
  const [error, setError] = useState<string | undefined>(undefined);

  function applyLink(): void {
    const href = value.trim();
    if (classifyHref(href) === null) {
      setError(CONTENT_DOC_MESSAGES.INVALID_LINK);
      return;
    }
    onOpenChange(false);
    if (!editor) return;
    if (editor.state.selection.empty) {
      // Empty selection outside a link: insert the address itself as
      // linked text, then drop the stored link mark so the very next
      // keystroke is plain text (owner decision).
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: href,
          marks: [{ type: "link", attrs: { href } }],
        })
        .unsetMark("link")
        .run();
    } else {
      editor.chain().focus().setLink({ href }).run();
    }
  }

  function removeLink(): void {
    onOpenChange(false);
    // The opening click already extended the range over the whole link.
    editor?.chain().focus().unsetLink().run();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? "Ubah tautan" : "Pasang tautan"}
        onCloseAutoFocus={(event) => {
          // Back to the canvas, not the toolbar button (card §5). The
          // isDestroyed guard: this can fire during unmount, after the
          // editor was destroyed (the commands getter throws then).
          event.preventDefault();
          if (editor && !editor.isDestroyed) editor.commands.focus();
        }}
      >
        <form
          noValidate
          onSubmit={(event) => {
            // The editor sits inside S1-04's <form>; React submit events
            // travel through the portal to it, so stop both.
            event.preventDefault();
            event.stopPropagation();
            applyLink();
          }}
          className="mt-4 flex flex-col gap-5"
        >
          <Field
            label="Alamat tautan"
            hint="Contoh: https://… untuk situs lain, atau /kursus/… untuk halaman BINZI."
            error={error}
          >
            <Input
              type="text"
              inputMode="url"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
              }}
            />
          </Field>
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
            {editing ? (
              <button
                type="button"
                onClick={removeLink}
                className="min-h-11 px-2 text-sm font-bold text-primary-deep"
              >
                Hapus tautan
              </button>
            ) : null}
            <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row-reverse">
              <Button type="submit">{editing ? "Simpan" : "Pasang"}</Button>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
