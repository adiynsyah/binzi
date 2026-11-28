"use client";

// "Alasan untuk user" + "Catatan internal (opsional)" (card S3-03 §6) —
// ONE component shared by the 26b decision form and the 26c manual reset
// form, wired to the caller's react-hook-form registration.
import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Textarea } from "@/components/ui/textarea";

export type ReasonFieldsProps = {
  reason: UseFormRegisterReturn;
  internalNote: UseFormRegisterReturn;
  reasonError?: string;
  internalNoteError?: string;
  disabled?: boolean;
};

export function ReasonFields({
  reason,
  internalNote,
  reasonError,
  internalNoteError,
  disabled,
}: ReasonFieldsProps) {
  const id = useId();
  const reasonId = `${id}-reason`;
  const noteId = `${id}-note`;
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={reasonId} className="flex items-center gap-2 text-sm font-bold text-text">
          Alasan untuk user
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
            Wajib
          </span>
        </label>
        <Textarea
          id={reasonId}
          rows={4}
          className="mt-2"
          disabled={disabled}
          aria-describedby={reasonError ? `${reasonId}-error` : `${reasonId}-hint`}
          aria-invalid={reasonError ? true : undefined}
          {...reason}
        />
        {reasonError ? (
          <p id={`${reasonId}-error`} className="mt-2 text-sm text-danger">
            {reasonError}
          </p>
        ) : (
          <p id={`${reasonId}-hint`} className="mt-2 text-sm text-text-meta">
            Tampil di halaman laporan peserta apa adanya.
          </p>
        )}
      </div>
      <div>
        <label htmlFor={noteId} className="block text-sm text-text-muted">
          <span className="font-bold text-text">Catatan internal</span> (opsional)
        </label>
        <Textarea
          id={noteId}
          rows={3}
          className="mt-2"
          disabled={disabled}
          aria-describedby={internalNoteError ? `${noteId}-error` : `${noteId}-hint`}
          aria-invalid={internalNoteError ? true : undefined}
          {...internalNote}
        />
        {internalNoteError ? (
          <p id={`${noteId}-error`} className="mt-2 text-sm text-danger">
            {internalNoteError}
          </p>
        ) : (
          <p id={`${noteId}-hint`} className="mt-2 text-sm text-text-meta">
            Hanya terlihat staf, masuk audit log
          </p>
        )}
      </div>
    </div>
  );
}
