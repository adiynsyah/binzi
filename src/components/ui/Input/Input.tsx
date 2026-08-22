import { useId, type ComponentPropsWithRef } from "react";
import styles from "./Input.module.scss";

/**
 * BINZI base input primitive — labeled text field for authentication
 * and CMS forms (UI/UX §30–§31). Validation errors are announced via
 * aria-invalid + aria-describedby (inline feedback, UI/UX §38).
 *
 * A visible <label> is required: this component intentionally takes
 * `label` as a mandatory prop rather than relying on aria-label.
 */
export type InputProps = ComponentPropsWithRef<"input"> & {
  /** Visible, programmatically associated label text. */
  label: string;
  /** Inline validation message. Presence marks the field invalid. */
  error?: string;
};

export function Input({ label, error, className, id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  const classes = [styles.input, error ? styles.invalid : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
