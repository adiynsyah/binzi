import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

/*
 * Text input (card A-05, COMPONENTS.md → "Dasar": height 52, radius 8–10).
 *
 * Mandatory states:
 * - hover    → border darkens slightly (border-strong → text-subtle)
 * - focus    → global 2px ring from globals.css; text inputs always match
 *              :focus-visible, so no per-component focus style is needed
 * - invalid  → pass `aria-invalid` (2px danger border, screen 2b);
 *              the Field wrapper wires this from its `error` prop
 * - disabled → solid disabled fill, no opacity
 * - loading  → the owning form locks fields while saving (screen 2b):
 *              render with `disabled` + `aria-busy`
 */

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-(--height-input) w-full rounded-control border border-border-strong bg-surface px-4 text-base text-text transition-colors duration-200 ease-out placeholder:text-text-meta",
        "hover:border-text-subtle",
        "aria-invalid:border-2 aria-invalid:border-danger",
        "aria-busy:cursor-progress",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled disabled:text-text-subtle",
        className,
      )}
      {...props}
    />
  );
}
