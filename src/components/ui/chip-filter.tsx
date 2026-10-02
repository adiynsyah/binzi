"use client";

import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Chip filter (card A-05, screens 17b/13b): visual height 40 (the 38–40
 * band) with pseudo-elements extending every touch zone to ≥44px. The
 * active chip is the NEUTRAL dark pill — not primary red (screen 13b:
 * "filters stay neutral"). Counts render inside the chip, separated from
 * the label by " · " exactly as in the 7a copy ("Semua · 3").
 *
 * Removable variant (17b "dengan ✕") is a SPLIT pill: the label zone
 * toggles (or renders as plain text when no onClick is given) and only
 * the ✕ zone removes the filter — it is its own button labeled
 * "Hapus filter <nama>" with a ≥44px hit area. Clicking the label never
 * removes the chip.
 */

export type ChipFilterProps = {
  /** Filter name shown inside the chip. */
  label: string;
  /** Result count rendered beside the label (screens 7a/13b). */
  count?: number;
  /** Dark "aktif" pill when true. */
  active?: boolean;
  /** Provide to render the ✕ zone; only that zone removes the filter. */
  onRemove?: () => void;
  /** Toggle handler for the label zone (and the whole plain chip). */
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

  const palette = disabled
    ? "border-transparent bg-surface-disabled text-text-subtle"
    : active
      ? "border-transparent bg-text text-surface"
      : "border-border-strong bg-surface text-text";
  const zoneHover = active ? "hover:bg-ink-surface" : "hover:bg-fill";
  const countCls = disabled
    ? "text-text-subtle"
    : active
      ? "text-ink-surface-text"
      : "text-text-meta";
  // Accessible name with the exact 7a copy ("Semua · 3") — content-based
  // naming would concatenate the spans without the spaces.
  const chipName = typeof count === "number" ? `${label} · ${count}` : label;
  const countPart =
    typeof count === "number" ? (
      <span className={cn("inline-flex items-center gap-1.5", countCls)}>
        <span aria-hidden="true">·</span>
        <span>{count}</span>
      </span>
    ) : null;

  if (removable) {
    return (
      <span
        className={cn(
          "relative inline-flex h-(--height-chip) items-stretch rounded-pill border text-sm font-bold transition-colors duration-200 ease-out",
          palette,
          className,
        )}
        style={style}
      >
        {onClick ? (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={chipName}
            onClick={onClick}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-s-pill px-4 transition-colors duration-200 ease-out",
              // Hit area: extend up/down/left, stay flush on the ✕ side.
              "before:absolute before:-inset-y-1 before:-left-1 before:right-0 before:content-['']",
              "disabled:cursor-not-allowed disabled:pointer-events-none",
              zoneHover,
            )}
          >
            <span>{label}</span>
            {countPart}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-s-pill px-4">
            <span>{label}</span>
            {countPart}
          </span>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={`Hapus filter ${label}`}
          onClick={onRemove}
          className={cn(
            "relative inline-flex w-9 items-center justify-center rounded-e-pill transition-colors duration-200 ease-out",
            "before:absolute before:-inset-x-1 before:-inset-y-1 before:content-['']",
            "disabled:cursor-not-allowed disabled:pointer-events-none",
            zoneHover,
            active ? "border-l border-ink-surface" : "border-l border-border-strong",
          )}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={chipName}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-(--height-chip) items-center gap-1.5 rounded-pill border px-4 text-sm font-bold transition-colors duration-200 ease-out",
        "before:absolute before:-inset-x-1 before:-inset-y-1 before:content-['']",
        "disabled:cursor-not-allowed disabled:pointer-events-none",
        palette,
        zoneHover,
        className,
      )}
      style={style}
    >
      <span>{label}</span>
      {countPart}
    </button>
  );
}
