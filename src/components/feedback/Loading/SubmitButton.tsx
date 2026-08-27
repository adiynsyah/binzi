"use client";

import type { ComponentPropsWithRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button with the pending state CMS §44 mandates: "Button
 * loading state for mutations … Prevent duplicate submissions —
 * [Publishing...] instead of allowing repeated clicks" (UI/UX §35
 * "Mutation button loading"; TASK 058 "Button loading"). Shared
 * feedback/Loading family per Architecture §7, adopted by the three
 * CMS plain-form mutation surfaces whose actions redirect instead of
 * returning useActionState states (assign-content 028, add-question
 * 033/034) — every useActionState form already carries its own
 * isPending label swap, so this component adds nothing on top of
 * those.
 *
 * `useFormStatus` reads the pending state of the enclosing <form>,
 * so the button must be rendered inside the form it submits (the
 * panels' pattern). While pending the button is disabled — the
 * duplicate-submission guard — and its label swaps to `pendingLabel`
 * ("Menambahkan…"). All other props (className, aria-label) forward
 * untouched; styling stays the host's own.
 */
export type SubmitButtonProps = ComponentPropsWithRef<"button"> & {
  /** Label shown while the form submission is pending. */
  pendingLabel: string;
};

export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  type = "submit",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
