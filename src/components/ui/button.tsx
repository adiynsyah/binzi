"use client";

import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Button (card A-05, COMPONENTS.md → "Dasar").
 *
 * Height is a `size` dimension kept SEPARATE from `variant` — TOKENS.md
 * phrases heights by role ("tombol utama 50–54 · sekunder 46–48"), and
 * screen 17b never hard-binds a height to a variant. Variants only pick
 * a default size (primary/dark → lg, others → md); callers may override.
 *
 * Mandatory states:
 * - hover    → darker end color per variant (primary → primary-deep)
 * - focus    → global 2px ring from globals.css (:focus-visible)
 * - disabled → SOLID fill (surface-disabled / text-subtle), never opacity
 * - loading  → label becomes the running verb via `loadingLabel` (Indonesian
 *   meN- conjugation is not mechanical, so the caller supplies it), the
 *   control is locked, aria-busy is set and a spinner precedes the label.
 */

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 rounded-control font-bold transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:pointer-events-none disabled:border-transparent disabled:bg-surface-disabled disabled:text-text-subtle",
  {
    variants: {
      variant: {
        primary: "bg-primary text-surface hover:bg-primary-deep",
        secondary:
          "border border-border-strong bg-surface text-text hover:bg-fill",
        dark: "bg-text text-surface hover:bg-ink-surface",
        ghost: "text-text hover:bg-fill",
        danger: "bg-danger text-surface hover:brightness-90",
      },
      size: {
        lg: "h-(--height-button-primary) px-6 text-base",
        md: "h-(--height-button-secondary) px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
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
