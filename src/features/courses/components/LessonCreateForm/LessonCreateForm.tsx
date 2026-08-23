"use client";

import Link from "next/link";
import { useActionState } from "react";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";
import type {
  LessonCreateState,
} from "@/features/courses/schemas/lesson-create.schema";

import styles from "./LessonCreateForm.module.scss";

/**
 * BINZI Lesson Create form (TASK 025, CMS Spec §8).
 *
 * Create-only by design: the field set is exactly CMS §8 "Create
 * Lesson" (Title required, Description optional). The Lesson Editor
 * metadata edit is a later task and deliberately does not share this
 * form (unlike Course create/edit, TASK 023, whose approved field
 * sets are identical).
 *
 * The action is bound to the course id by the server page, so the
 * course binding cannot be tampered with from the client. All
 * validation is authoritative server-side; native attributes are
 * only a first gate. Slug, status, sort order, and timestamps are
 * not inputs — they are server-owned (see the schema/mutation docs).
 */

export function LessonCreateForm({
  courseId,
  action,
}: {
  /** Server route-context id, used only for the cancel link target. */
  courseId: string;
  /** createLessonAction bound to the course id by the page. */
  action: (
    state: LessonCreateState,
    formData: FormData,
  ) => Promise<LessonCreateState>;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    { status: "idle" } satisfies LessonCreateState,
  );

  const errors = state.status === "error" ? state.errors : undefined;
  const builderHref = `/admin/courses/${courseId}/edit`;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.fields}>
        <div className={styles.field}>
          <Input
            label="Judul Pelajaran"
            name="title"
            required
            disabled={isPending}
            error={errors?.title}
          />
          <p className={styles.hint}>
            Slug URL dibuat otomatis dari judul dan hanya berlaku di dalam
            kursus ini.
          </p>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="lesson-description">
            Deskripsi
          </label>
          <textarea
            id="lesson-description"
            name="description"
            rows={5}
            disabled={isPending}
            className={
              errors?.description ? styles.textareaInvalid : styles.textarea
            }
            aria-invalid={errors?.description ? true : undefined}
          />
          {errors?.description ? (
            <p className={styles.fieldError}>{errors.description}</p>
          ) : null}
          <p className={styles.hint}>
            Opsional — ringkasan singkat isi pelajaran.
          </p>
        </div>
      </div>

      <div className={styles.statusNote}>
        <Badge tone="warning">Draf</Badge>
        <p className={styles.statusText}>
          Pelajaran baru selalu disimpan sebagai draf, ditambahkan di akhir
          daftar pelajaran, dan belum tayang.
        </p>
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan…" : "Simpan sebagai Draf"}
        </Button>
        <Link
          href={builderHref}
          className={`${buttonStyles.button} ${buttonStyles.secondary}`}
        >
          Batal
        </Link>
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className={styles.messageError}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
