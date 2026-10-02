"use client";

import { cloneElement, useId, type ReactElement } from "react";
import { cn } from "../../lib/utils";

/*
 * Field — label + control + hint/error wiring (card A-05).
 *
 * Associates its single child control with the label and injects
 * `aria-describedby` (hint and/or error) plus `aria-invalid` when `error`
 * is set. The error renders BELOW the control (screen 2b) and replaces
 * the hint so the row under the input never grows twice.
 */

export type FieldProps = {
  /** Visible label above the control. */
  label: string;
  /** Supporting text below the control; hidden while `error` is set. */
  hint?: string;
  /** Per-field error message; also flags the control aria-invalid. */
  error?: string;
  /** Control id; generated from useId() when omitted. */
  id?: string;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
};

export function Field({
  label,
  hint,
  error,
  id,
  children,
  className,
}: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy =
    [
      hint && !error ? `${fieldId}-hint` : null,
      error ? `${fieldId}-error` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={fieldId} className="block text-sm font-bold text-text">
        {label}
      </label>
      <div className="mt-2">
        {cloneElement(children, {
          id: fieldId,
          "aria-describedby": describedBy,
          ...(error ? { "aria-invalid": true } : {}),
        })}
      </div>
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="mt-2 text-sm text-text-meta">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
