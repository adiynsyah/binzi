import type { ComponentPropsWithRef } from "react";
import styles from "./Button.module.scss";

/**
 * BINZI base button primitive.
 *
 * Variants are limited to those required by the UI/UX Specification:
 * - primary   → main CTAs (hero, enrollment, quiz submit, auth)
 * - secondary → secondary CTAs (explore articles, review course/lesson)
 * - danger    → destructive CMS actions (e.g. draft deletion confirm)
 *
 * Renders a native <button>. Navigation links must use Next.js <Link>,
 * not this component.
 */
export type ButtonVariant = "primary" | "secondary" | "danger";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  /** Visual variant. Defaults to "primary". */
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...props} />;
}
