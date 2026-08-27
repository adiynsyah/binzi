import type { ComponentPropsWithRef } from "react";

import styles from "./Skeleton.module.scss";

/**
 * BINZI skeleton primitives (TASK 058, UI/UX §35 "Loading States";
 * CMS §44 "Skeleton for page/list loading"; Architecture §7 shared
 * feedback/Loading family).
 *
 * "Avoid blank screens while data is loading" (§35): every route
 * loading.tsx composes these server-renderable blocks into the shape
 * of the page it substitutes — card grids for the public catalogs,
 * table rows for the CMS lists, field blocks for the editors. The
 * blocks are decorative (aria-hidden); the hosting loading.tsx owns
 * the role="status"/aria-busy wrapper and the sr-only "Memuat…"
 * announcement so screen readers hear one loading statement, not a
 * list of gray rectangles.
 *
 * The opacity pulse lives in the module SCSS and is frozen by the
 * GLOBAL reduced-motion rule (globals.scss, UI/UX §42) — no local
 * motion override is needed. Styling is entirely token-derived; no
 * skeleton carries text content.
 */

/** One gray block. `variant` picks a token-sized height/width pairing. */
export type SkeletonVariant =
  | "title"
  | "heading"
  | "text"
  | "textShort"
  | "small"
  | "block";

export type SkeletonProps = ComponentPropsWithRef<"span"> & {
  variant?: SkeletonVariant;
};

export function Skeleton({
  variant = "text",
  className,
  ...props
}: SkeletonProps) {
  const classes = [styles.skeleton, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  return <span aria-hidden="true" className={classes} {...props} />;
}

/** The row marker for list-like shapes (e.g. quiz option rows). */
export function SkeletonDot(
  props: ComponentPropsWithRef<"span">,
) {
  return <span aria-hidden="true" className={styles.dot} {...props} />;
}

/**
 * Card skeleton (§35 "skeleton course cards" / "skeleton article") —
 * a quiet stand-in for the Card-based catalog/featured cards, reusing
 * the family's card frame so the swap to real content is not jarring.
 */
export function SkeletonCard() {
  return (
    <div className={styles.card} aria-hidden="true">
      <Skeleton variant="small" />
      <Skeleton variant="title" />
      <Skeleton variant="text" />
      <Skeleton variant="textShort" />
    </div>
  );
}

/**
 * Table skeleton (§35 CMS "table skeleton") — `rows` body rows under
 * a header row of `columns` cells. Column widths are deliberately
 * generic (flex-equal cells); the shape reads as "a table is coming"
 * without pretending to know each list's real column ratios.
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  const cells = Array.from({ length: columns });

  return (
    <div className={styles.table} aria-hidden="true">
      <div className={styles.tableHeader}>
        {cells.map((_, index) => (
          <span key={index} className={styles.tableCell} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className={styles.tableRow}>
          {cells.map((_, colIndex) => (
            <span key={colIndex} className={styles.tableCell} />
          ))}
        </div>
      ))}
    </div>
  );
}
