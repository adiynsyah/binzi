"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button/Button";
import {
  initialPublishState,
  type PublishCheck,
  type PublishState,
} from "@/features/courses/schemas/publish.schema";

import styles from "./PublishForm.module.scss";

/**
 * BINZI shared publish form (TASK 035, CMS §19/§29/§30 + §48).
 *
 * One component serves the Lesson publish and Course publish
 * surfaces — both are "explicit publish of a persisted entity with an
 * actionable readiness checklist" and share the exact TASK 020
 * publish contract (PublishContentForm precedent): a separate form
 * that submits NOTHING (ids are bound server-side), a pending label
 * per CMS §44, and actionable errors per CMS §18/§35.
 *
 * The checklist rendered before a submit is page-computed guidance
 * (BR §32: the UI may guide); after a rejection the authoritative
 * server-computed checks from the action state take its place, so the
 * admin always sees the true persisted state after trying.
 *
 * Already-published entities never render this component (the pages
 * hide it); the server independently rejects republishing.
 */
export function PublishForm({
  headingId,
  heading,
  note,
  action,
  checks,
}: {
  /** Stable id for aria-labelledby (also the test anchor). */
  headingId: string;
  heading: string;
  note: string;
  /** publishLesson/publishCourse action bound to the entity ids. */
  action: () => Promise<PublishState>;
  /** Page-computed readiness checklist (guidance, not authority). */
  checks: PublishCheck[];
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialPublishState satisfies PublishState,
  );

  const activeChecks =
    state.status === "error" && state.checks ? state.checks : checks;

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 className={styles.heading} id={headingId}>
          {heading}
        </h2>
        <p className={styles.note}>{note}</p>
      </div>
      <ul className={styles.checklist}>
        {activeChecks.map((check) => (
          <li
            key={check.id}
            className={
              check.state === "pass" ? styles.checkPass : styles.checkFail
            }
          >
            <span className={styles.checkMark}>
              {check.state === "pass" ? "✓" : "✗"}
            </span>
            <span className={styles.checkLabel}>{check.label}</span>
          </li>
        ))}
      </ul>
      <form action={formAction} className={styles.form}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menerbitkan…" : "Terbitkan"}
        </Button>
      </form>
      {state.status === "error" && state.message ? (
        <p role="alert" className={styles.messageError}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
