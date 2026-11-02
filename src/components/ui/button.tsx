"use client";

import type { ButtonHTMLAttributes, Ref } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./button-variants";

/*
 * Button (card A-05, COMPONENTS.md → "Dasar").
 *
 * Height is a `size` dimension kept SEPARATE from `variant` — TOKENS.md
 * phrases heights by role ("tombol utama 50–54 · sekunder 46–48"), and
 * screen 17b never hard-binds a height to a variant. Variants only pick
 * a default size (primary/dark → lg, others → md); callers may override.
 *
 * Heights are MINIMUMS, not fixed: a long label (e.g. empty-state actions
 * that name their filter + count, screen 28e) wraps with text-balance and
 * GROWS the button instead of overflowing it. Single-line labels keep the
 * exact token height.
 *
 * Mandatory states:
 * - hover    → darker end color per variant (primary → primary-deep)
 * - focus    → global 2px ring from globals.css (:focus-visible)
 * - disabled → SOLID fill (surface-disabled / text-subtle), never opacity
 * - loading  → label becomes the running verb via `loadingLabel` (Indonesian
 *   meN- conjugation is not mechanical, so the caller supplies it), the
 *   control is locked, aria-busy is set and a spinner precedes the label.
 * - softDisabled (card C-08) → the LOOK of disabled (solid fill, no hover
 *   change, cursor-not-allowed) via aria-disabled variants, but the control
 *   STAYS focusable and clickable so keyboard users can reach it — the
 *   caller's handler owns the activation guard.
 */

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantProps & {
    /** While true the control is locked and marked aria-busy. */
    loading?: boolean;
    /** Running-verb label shown while loading, e.g. "Menyimpan…". */
    loadingLabel?: string;
    /**
     * Marks the control aria-disabled="true" with the disabled LOOK, but —
     * unlike `disabled` — does NOT block focus or activation (no
     * pointer-events-none, no disabled attribute). The handler that owns
     * the gating MUST guard the action itself (card C-08: Turnstile-gated
     * submits stay Tab-reachable while the challenge is pending).
     */
    softDisabled?: boolean;
    /** Forwarded to the <button> element (React 19 ref-as-prop). */
    ref?: Ref<HTMLButtonElement>;
  };

export function Button({
  className,
  variant = "primary",
  size,
  loading = false,
  loadingLabel,
  softDisabled = false,
  disabled,
  ref,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  // Variant-level default height (TOKENS.md roles): primary & dark actions
  // sit in the tall band; secondary, ghost and danger in the lower one.
  const resolvedSize =
    size ?? (variant === "primary" || variant === "dark" ? "lg" : "md");

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-disabled={softDisabled || undefined}
      aria-busy={loading || undefined}
      className={cn(
        buttonVariants({ variant, size: resolvedSize }),
        className,
      )}
      {...props}
    >
      {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
