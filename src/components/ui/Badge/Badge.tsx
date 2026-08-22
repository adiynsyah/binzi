import type { ComponentPropsWithRef } from "react";
import styles from "./Badge.module.scss";

/**
 * BINZI base badge primitive — non-interactive status indicator used for
 * course difficulty (UI/UX §6), DRAFT/PUBLISHED status (CMS §13),
 * and quiz result states such as PASSED (UI/UX §22).
 */
export type BadgeTone = "neutral" | "success" | "warning" | "danger";

export type BadgeProps = ComponentPropsWithRef<"span"> & {
  /** Semantic tone. Defaults to "neutral". */
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  const classes = [styles.badge, styles[tone], className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} {...props} />;
}
