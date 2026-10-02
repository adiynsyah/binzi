"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { cn } from "../../lib/utils";
import styles from "./skeleton.module.css";

/*
 * Skeleton (card A-06, screen 28d): placeholders MIMIC the real card /
 * row shape so the layout never jumps when data lands — no spinners.
 * Nothing renders until SKELETON_DELAY_MS has elapsed: fast networks
 * skip the flicker entirely, slow ones get the skeleton.
 *
 * Usage: gate placeholders on useSkeletonDelay(isLoading) and wrap the
 * loading area in <SkeletonList> (aria-busy + a polite "Memuat…" for
 * screen readers).
 */

export const SKELETON_DELAY_MS = 300;

/**
 * Returns true once `active` has stayed true for `delay` ms. Re-arming
 * (active going false → true) restarts the delay.
 */
export function useSkeletonDelay(active: boolean, delay = SKELETON_DELAY_MS) {
  const [state, setState] = useState<{ active: boolean; visible: boolean }>({
    active,
    visible: false,
  });

  // "Adjust state when a prop changes" (React docs): resetting during
  // render keeps the epoch in sync so a re-armed `active` starts its
  // delay over, without a synchronous setState inside the effect.
  if (state.active !== active) {
    setState({ active, visible: false });
  }

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(
      () => setState({ active, visible: true }),
      delay,
    );
    return () => clearTimeout(timer);
  }, [active, delay]);

  return state.active === active && state.visible;
}

/** One shimmering placeholder block — decorative by design (aria-hidden). */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(styles.shimmer, "rounded-pill", className)}
      {...props}
    />
  );
}

/** Card-shaped skeleton: image block, title lines, meta pills, button. */
export function SkeletonCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface p-4",
        className,
      )}
      {...props}
    >
      <Skeleton className="h-32 rounded-card" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-4 h-6 w-24" />
      <Skeleton className="mt-4 h-11 w-full rounded-control" />
    </div>
  );
}

/** Row-shaped skeleton: square thumb + two text lines. */
export function SkeletonRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-card border border-border bg-surface p-4",
        className,
      )}
      {...props}
    >
      <Skeleton className="size-16 shrink-0 rounded-card" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/3" />
      </div>
    </div>
  );
}

/**
 * Loading area wrapper: marks the region aria-busy and announces a
 * polite "Memuat…" while the real content has not landed yet.
 */
export function SkeletonList({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div role="status" aria-busy="true" className={className} {...props}>
      <p className="sr-only">Memuat…</p>
      {children}
    </div>
  );
}
