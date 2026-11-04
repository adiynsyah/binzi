import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * Multiline text input (card S1-01, screen 21f "Ringkasan"): the same visual
 * contract as Input (card A-05) — border, radius, fills, invalid and
 * disabled states — on a taller auto-growing box (min-height 70px) with a
 * character counter supplied by the owning Field row.
 *
 * `resize-none`: the 21f dialog gives the box a fixed footprint next to its
 * counter; free resizing would detach the two.
 */

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-[70px] w-full resize-none rounded-control border border-border-strong bg-surface px-4 py-3 text-base text-text transition-colors duration-200 ease-out placeholder:text-text-meta",
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
