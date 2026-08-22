import type { ComponentPropsWithRef } from "react";
import styles from "./Card.module.scss";

/**
 * BINZI base card primitive — a simple bordered surface container
 * suitable for course cards, article cards, and content sections
 * (UI/UX §6). Domain-specific card variants (e.g. CourseCard) belong
 * in their feature folders and compose this primitive.
 */
export type CardProps = ComponentPropsWithRef<"div">;

export function Card({ className, ...props }: CardProps) {
  const classes = [styles.card, className].filter(Boolean).join(" ");

  return <div className={classes} {...props} />;
}
