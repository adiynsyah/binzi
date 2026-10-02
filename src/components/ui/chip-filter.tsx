"use client";

import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Chip filter (card A-05, screens 17b/13b): visual height 40 (the 38–40
 * band) with a pseudo-element extending the touch area to ≥44px. The
 * active chip is the NEUTRAL dark pill — not primary red (screen 13b:
 * "filters stay neutral"). Counts render inside the chip ("Semua 3").
 *
 * With `onRemove` the whole chip becomes ONE remove control labeled
 * "Hapus filter <nama>"; the ✕ glyph itself is aria-hidden.
 */

export type ChipFilterProps = {
  /** Filter name shown inside the chip. */
  label: string;
  /** Result count rendered beside the label (screens 7a/13b). */
  count?: number;
  /** Dark "aktif" pill when true. */
  active?: boolean;
  /** Provide to render the ✕ remove variant. */
  onRemove?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function ChipFilter({
  label,
  count,
  active = false,
  onRemove,
  onClick,
  disabled = false,
  className,
  style,
}: ChipFilterProps) {
  const removable = typeof onRemove === "function";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={removable ? undefined : active}
      aria-label={removable ? `Hapus filter ${label}` : undefined}
      onClick={removable ? onRemove : onClick}
      style={style}
      className={cn(
        "relative inline-flex h-(--height-chip) items-center gap-1.5 rounded-pill px-4 text-sm font-bold transition-colors duration-200 ease-out",
        "before:absolute before:-inset-x-1 before:-inset-y-1 before:content-['']",
        "disabled:cursor-not-allowed disabled:pointer-events-none disabled:border-transparent disabled:bg-surface-disabled disabled:text-text-subtle",
        active
          ? "bg-text text-surface hover:bg-ink-surface"
          : "border border-border-strong bg-surface text-text hover:bg-fill",
        className,
      )}
    >
      <span>{label}</span>
      {removable ? (
        <X aria-hidden="true" className="size-4" />
      ) : (
        typeof count === "number" && (
          <span
            className={active ? "text-ink-surface-text" : "text-text-meta"}
          >
            {count}
          </span>
        )
      )}
    </button>
  );
}
