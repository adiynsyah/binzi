"use client";

import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
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
 */

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantProps & {
    /** While true the control is locked and marked aria-busy. */
    loading?: boolean;
    /** Running-verb label shown while loading, e.g. "Menyimpan…". */
    loadingLabel?: string;
  };

export function Button({
  className,
  variant = "primary",
  size,
  loading = false,
  loadingLabel,
  disabled,
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
      type={type}
      disabled={disabled || loading}
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
