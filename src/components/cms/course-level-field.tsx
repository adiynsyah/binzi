/*
 * Level segmented control (card S1-02 §2), extracted verbatim from
 * create-course-dialog.tsx (21f) so the dialog and the builder settings
 * panel share ONE control with an identical appearance.
 *
 * Native radios stay (fieldset + legend + arrow-key navigation, focus pass
 * targets the checked one) but are sr-only inside pill labels — the checked
 * pill inverts (dark `text` token + surface text, not primary), and the
 * focus ring lands on the pill via peer-focus-visible (offset against the
 * frame's surface-2). Three pills share a fixed 3-column grid, one row at
 * every width. Pills are min-h-11 (44 px) — a deliberate deviation from
 * 21f's 38 px to honor the >= 44 px touch-target rule.
 *
 * Plain module (no hooks): `registration` carries react-hook-form's
 * register("level") return; `onFieldsetElement` hands the enclosing
 * fieldset back for the caller's focus pass.
 */
import type { UseFormRegisterReturn } from "react-hook-form";

import { COURSE_LEVELS, COURSE_LEVEL_LABELS } from "@/modules/course/schema";

import { FieldError } from "./form-fields";

export function CourseLevelField({
  errorId,
  error,
  registration,
  onFieldsetElement,
}: {
  /** id of the FieldError paragraph (unique per form). */
  errorId: string;
  error?: string;
  /** react-hook-form registration of the "level" radio group. */
  registration: UseFormRegisterReturn;
  /** Receives the enclosing <fieldset> on each radio ref call. */
  onFieldsetElement?: (fieldset: HTMLFieldSetElement | null) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-text">Level</legend>
      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-control border border-border-strong bg-surface-2 p-1">
        {COURSE_LEVELS.map((level) => (
          <label key={level} className="cursor-pointer">
            <input
              type="radio"
              value={level}
              className="peer sr-only"
              ref={(element) => {
                registration.ref(element);
                onFieldsetElement?.(element?.closest("fieldset") ?? null);
              }}
              name={registration.name}
              onChange={registration.onChange}
              onBlur={registration.onBlur}
            />
            <span className="flex min-h-11 w-full items-center justify-center rounded-sm px-2 text-center text-sm font-bold text-text-nav transition-colors duration-200 ease-out hover:bg-fill peer-checked:bg-text peer-checked:text-surface peer-checked:hover:bg-text peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-2">
              {COURSE_LEVEL_LABELS[level]}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
