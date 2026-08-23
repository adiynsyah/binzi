"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button/Button";
import type { ContentPublishState } from "@/features/contents/schemas/content-publish.schema";

import styles from "./PublishContentForm.module.scss";

/**
 * BINZI Content Publish form (TASK 020, CMS Spec §18/§30, UI/UX §24).
 *
 * Explicit publish action for DRAFT content, rendered by the edit
 * page below the edit form (separate <form> — publish always
 * evaluates the PERSISTED row server-side, so it must not submit the
 * editor's unsaved state). Already-published rows never render this
 * component; the server independently rejects republishing.
 *
 * Validation failures render as an actionable per-field list per
 * CMS §18 ("show actionable errors", e.g. a video missing its video
 * URL), never a bare "Validation failed". The UI/UX Specification
 * defines no publish confirmation step, so the button acts directly.
 */
export function PublishContentForm({
  action,
}: {
  /** publishContentAction bound to the content id by the server page. */
  action: (
    state: ContentPublishState,
    formData: FormData,
  ) => Promise<ContentPublishState>;
}) {
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle",
  } satisfies ContentPublishState);

  const errorList = state.status === "error" ? state.errors : undefined;

  return (
    <section className={styles.panel} aria-labelledby="publish-heading">
      <div className={styles.header}>
        <h2 className={styles.heading} id="publish-heading">
          Terbitkan Konten
        </h2>
        <p className={styles.note}>
          Penerbitan bersifat eksplisit: konten yang diterbitkan tampil
          publik. Konten divalidasi dari data yang sudah tersimpan —
          simpan draf terlebih dahulu jika ada perubahan belum tersimpan.
        </p>
      </div>
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
      {errorList ? (
        <ul className={styles.errorList}>
          {Object.entries(errorList).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
