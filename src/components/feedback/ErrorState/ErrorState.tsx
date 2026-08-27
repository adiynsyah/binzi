"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button/Button";

import styles from "./ErrorState.module.scss";

/**
 * BINZI error-state presentation (TASK 059, UI/UX §37 "Errors should
 * explain what happened and what to do next"; CMS §45 "Something went
 * wrong / We couldn't load this course / [Try Again]"; BR §39
 * actionable copy; Architecture §7 shared feedback family).
 *
 * The ONE rendering surface for TASK 059's boundary-shaped errors:
 * the segment error.tsx files (network/render failures — retry via
 * the boundary `reset`) and the not-found.tsx files (no retry — a
 * way back instead). Copy stays plain Indonesian and actionable; no
 * stack traces, no raw error details (CMS §45 / Architecture §27 —
 * those belong to the server logs the mutations already write).
 *
 * role="alert" carries the UI/UX §43 "accessible error messages"
 * discipline; actions are 44px targets (§34). Server component hosts
 * may render it too — the only client need is the optional retry
 * handler, which error boundaries pass as `reset`.
 */
export type ErrorStateProps = {
  title: string;
  description: string;
  /** Boundary reset handler — renders the [Try Again] button. */
  onRetry?: () => void;
  retryLabel?: string;
  /** A way forward when retry cannot help (e.g. 404 → home). */
  linkHref?: string;
  linkLabel?: string;
};

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Coba Lagi",
  linkHref,
  linkLabel,
}: ErrorStateProps) {
  return (
    <div className={styles.errorState} role="alert">
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      {onRetry || linkHref ? (
        <div className={styles.actions}>
          {onRetry ? (
            <Button type="button" variant="primary" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {linkHref && linkLabel ? (
            <Link className={styles.link} href={linkHref}>
              {linkLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
