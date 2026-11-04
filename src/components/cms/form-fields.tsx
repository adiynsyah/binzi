/*
 * Shared CMS form atoms (card S1-02 §2): LabelRow (label + "used / max"
 * mono counter) and FieldError (the danger field message), extracted
 * verbatim from create-course-dialog.tsx so the 21f dialog and the builder
 * settings panel render identical fields — one source, no copies.
 *
 * Plain module on purpose (no "use client", no hooks): usable from server
 * and client components alike, like cms-pages.tsx.
 */

export function LabelRow({
  htmlFor,
  label,
  used,
  max,
}: {
  htmlFor: string;
  label: string;
  used: number;
  max: number;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="text-sm font-bold text-text">
        {label}
      </label>
      <span className="font-mono text-xs text-text-meta">
        {used} / {max}
      </span>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-sm text-danger">
      {message}
    </p>
  );
}
