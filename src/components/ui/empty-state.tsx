"use client";

import { Button, buttonVariants } from "./button";
import { cn } from "../../lib/utils";

/*
 * Empty state (card A-06, screens 13c · 28d · 28e): one component for
 * all three situations — kosong (nothing yet), filter kosong (zero
 * results, NAME the filter that caused it), gagal memuat (in place of
 * the cards, never an error page). Anatomy is identical; only the copy
 * differs between screens.
 *
 * The two actions are REQUIRED OBJECT props (not ReactNode, which could
 * be null) so TypeScript guarantees every empty state offers one primary
 * way out plus one alternative (COMPONENTS.md). They render as A-05
 * Buttons — href actions render an anchor with the same button styling.
 */

export type EmptyStateAction = {
  label: string;
  /** Renders the action as an anchor styled like the button variant. */
  href?: string;
  onClick?: () => void;
};

export type EmptyStateProps = {
  /** Small uppercase mono label, e.g. "KONEKSI · KODE 503". */
  label: string;
  title: string;
  description?: string;
  /** Required: the primary way out (primary Button). */
  primaryAction: EmptyStateAction;
  /** Required: the alternative way out (secondary Button). */
  alternativeAction: EmptyStateAction;
  className?: string;
};

// Equal widths (flex-1) + stretched heights keep the pair tidy when a
// long label (filter + count, 28e) wraps: both buttons wrap symmetrically
// instead of one ragged column. Below sm the actions stack full-width.
const ACTION_BUTTON_CLASSES = "w-full sm:w-auto sm:flex-1";

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: "primary" | "secondary";
}) {
  if (action.href !== undefined) {
    return (
      <a
        href={action.href}
        className={cn(buttonVariants({ variant }), ACTION_BUTTON_CLASSES)}
      >
        {action.label}
      </a>
    );
  }
  return (
    <Button
      variant={variant}
      onClick={action.onClick}
      className={ACTION_BUTTON_CLASSES}
    >
      {action.label}
    </Button>
  );
}

export function EmptyState({
  label,
  title,
  description,
  primaryAction,
  alternativeAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-border-dashed bg-surface-2 p-6 sm:p-8",
        className,
      )}
    >
      <p className="font-mono text-xs uppercase tracking-wide text-text-subtle">
        {label}
      </p>
      <h3 className="mt-2 text-xl font-black tracking-tight text-text">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-(--width-measure) text-text-muted">
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <ActionButton action={primaryAction} variant="primary" />
        <ActionButton action={alternativeAction} variant="secondary" />
      </div>
    </div>
  );
}
