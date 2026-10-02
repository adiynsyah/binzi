"use client";

import { cn } from "../../lib/utils";

/*
 * Progress bar (card A-06, screens 8a · 7d): thin 8px track on `fill`.
 * Two tones only (TOKENS/COMPONENTS): success = course progress,
 * primary = an activity currently running. The value change animates
 * with the 200ms ease-out motion token and flattens instantly under
 * prefers-reduced-motion (globals.css).
 */

export type ProgressBarProps = {
  /** Current value; clamped into [min, max]. */
  value: number;
  /** Accessible name — required (every control is labelled, 17b). */
  label: string;
  /** success = course progress (default) · primary = running. */
  tone?: "success" | "primary";
  min?: number;
  max?: number;
  className?: string;
};

export function ProgressBar({
  value,
  label,
  tone = "success",
  min = 0,
  max = 100,
  className,
}: ProgressBarProps) {
  const span = max - min;
  const clamped = span > 0 ? Math.min(Math.max(value, min), max) : min;
  const percent = span > 0 ? ((clamped - min) / span) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-2 w-full overflow-hidden rounded-pill bg-fill", className)}
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-full rounded-pill transition-[width] duration-200 ease-out",
          tone === "primary" ? "bg-primary" : "bg-success",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
