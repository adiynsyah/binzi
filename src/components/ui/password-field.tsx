"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { Input } from "./input";
import {
  passwordRules,
  satisfiedPasswordRules,
} from "./password-rules";
import { cn } from "../../lib/utils";

/*
 * PasswordField (card A-05, screens 3a/2b).
 *
 * - The eye toggle is a full 44px touch target and reports its state via
 *   aria-pressed with the labels agreed in the card revision notes.
 * - Requirement pills mirror screen 3a: gray dot → green dot.
 * - The polite live region announces ONLY when the number of satisfied
 *   rules changes ("2 dari 3 syarat terpenuhi"), never per keystroke;
 *   the pills themselves stay OUTSIDE the live region.
 * - Loading locks the input and the eye button (screen 2b) while the
 *   owning form is saving.
 */

export type PasswordFieldProps = {
  /** Visible label; defaults to the copy from screen 3a. */
  label?: string;
  /** Field id; generated when omitted. */
  id?: string;
  name?: string;
  /** Controlled value; omit for an internally managed one. */
  value?: string;
  defaultValue?: string;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
  disabled?: boolean;
  /** Locks the field while the owning form is saving (screen 2b). */
  loading?: boolean;
  /** Per-field error message below the input. */
  error?: string;
  className?: string;
};

export function PasswordField({
  label = "Kata sandi",
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  disabled = false,
  loading = false,
  error,
  className,
}: PasswordFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;
  const satisfied = satisfiedPasswordRules(currentValue);
  const metIds = new Set(satisfied.map((rule) => rule.id));

  // Live region: update only on a CHANGE of the satisfied count, so a
  // screen reader hears brief progress, not every keystroke.
  const [announcement, setAnnouncement] = useState("");
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    const count = satisfied.length;
    if (lastCount.current !== null && lastCount.current !== count) {
      setAnnouncement(`${count} dari ${passwordRules.length} syarat terpenuhi`);
    }
    lastCount.current = count;
  }, [satisfied.length]);

  const locked = disabled || loading;

  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={fieldId} className="block text-sm font-bold text-text">
        {label}
      </label>
      <div className="relative mt-2">
        <Input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          value={currentValue}
          onChange={(event) => {
            setInternalValue(event.target.value);
            onChange?.(event);
          }}
          disabled={locked}
          aria-busy={loading || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className="pr-14"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={
            visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
          }
          disabled={locked}
          className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-control text-text-meta transition-colors duration-200 ease-out hover:bg-fill hover:text-text disabled:cursor-not-allowed disabled:text-text-subtle disabled:hover:bg-transparent"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="mt-3 flex flex-wrap gap-2">
        {passwordRules.map((rule) => {
          const met = metIds.has(rule.id);
          return (
            <li
              key={rule.id}
              className="inline-flex items-center gap-2 rounded-pill border border-border-soft bg-surface-2 px-3 py-1 text-sm text-text-meta"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-pill",
                  met ? "bg-success" : "bg-border-strong",
                )}
              />
              {rule.label}
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
