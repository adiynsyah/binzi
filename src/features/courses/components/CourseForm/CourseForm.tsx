"use client";

import Link from "next/link";
import { useActionState } from "react";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";
import { courseDifficulty } from "@/db/schema/enums";
import type {
  CourseMetadataState,
  EditableCourse,
} from "@/features/courses/schemas/course-metadata.schema";

import styles from "./CourseForm.module.scss";

/**
 * BINZI Course metadata form (TASK 023, CMS Spec §6/§7).
 *
 * One form serves Create and Edit — the approved field sets are
 * identical (Title, Description, Thumbnail URL, Difficulty, Estimated
 * Duration; Content needed two forms only because its slug rules
 * differ between create and edit). On edit the form is pre-populated
 * from the persisted record and the action is bound to the course id
 * by the server page, so the id cannot be tampered with from the
 * client. All validation is authoritative server-side; native
 * attributes are only a first gate.
 *
 * Slug is NOT an input: it is generated from the title at creation
 * (CMS §6) and immutable afterwards — on edit it is displayed read-only.
 * Status is not a field either: creation always produces DRAFT and
 * saving never changes status (Business Rules §22; the Course publish
 * workflow is a later task, not TASK 023).
 */

/** Same labels as the Course List (TASK 022). */
const DIFFICULTY_LABELS: Record<
  (typeof courseDifficulty.enumValues)[number],
  string
> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

const STATUS_NOTE: Record<"DRAFT" | "PUBLISHED", string> = {
  DRAFT: "Kursus masih draf dan belum tayang.",
  PUBLISHED: "Kursus ini sudah terbit dan tayang publik.",
};

export function CourseForm({
  course,
  action,
}: {
  /** Present on edit; absent on create. */
  course?: EditableCourse;
  /** createCourseAction, or updateCourseAction bound to the course id. */
  action: (
    state: CourseMetadataState,
    formData: FormData,
  ) => Promise<CourseMetadataState>;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    { status: "idle" } satisfies CourseMetadataState,
  );

  const errors = state.status === "error" ? state.errors : undefined;
  const isEdit = course !== undefined;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.fields}>
        <div className={styles.field}>
          <Input
            label="Judul Kursus"
            name="title"
            required
            disabled={isPending}
            defaultValue={course?.title}
            error={errors?.title}
          />
          {isEdit ? (
            <p className={styles.hint}>
              Slug: <code>{course.slug}</code> — dibuat otomatis saat kursus
              dibuat dan tidak berubah saat menyunting.
            </p>
          ) : (
            <p className={styles.hint}>
              Slug URL dibuat otomatis dari judul.
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="course-description">
            Deskripsi
          </label>
          <textarea
            id="course-description"
            name="description"
            rows={5}
            required
            disabled={isPending}
            defaultValue={course?.description}
            className={
              errors?.description ? styles.textareaInvalid : styles.textarea
            }
            aria-invalid={errors?.description ? true : undefined}
          />
          {errors?.description ? (
            <p className={styles.fieldError}>{errors.description}</p>
          ) : null}
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="course-difficulty">
            Tingkat Kesulitan
          </label>
          <select
            id="course-difficulty"
            name="difficulty"
            disabled={isPending}
            defaultValue={course?.difficulty ?? "BEGINNER"}
            className={errors?.difficulty ? styles.selectInvalid : styles.select}
            aria-invalid={errors?.difficulty ? true : undefined}
          >
            {courseDifficulty.enumValues.map((value) => (
              <option key={value} value={value}>
                {DIFFICULTY_LABELS[value]}
              </option>
            ))}
          </select>
          {errors?.difficulty ? (
            <p className={styles.fieldError}>{errors.difficulty}</p>
          ) : null}
        </div>
        <div className={styles.field}>
          <Input
            label="Durasi Estimasi"
            name="estimatedDuration"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            disabled={isPending}
            defaultValue={course?.estimatedDuration ?? undefined}
            error={errors?.estimatedDuration}
          />
          <p className={styles.hint}>
            Durasi total kursus dalam menit, mis. 120.
          </p>
        </div>
        <div className={styles.field}>
          <Input
            label="URL Thumbnail"
            name="thumbnailUrl"
            type="url"
            disabled={isPending}
            defaultValue={course?.thumbnailUrl ?? ""}
            error={errors?.thumbnailUrl}
          />
          <p className={styles.hint}>
            Opsional — URL gambar sampul kursus (http/https).
          </p>
        </div>
      </div>

      <div className={styles.statusNote}>
        <Badge
          tone={
            isEdit && course.status === "PUBLISHED" ? "success" : "warning"
          }
        >
          {isEdit && course.status === "PUBLISHED" ? "Terbit" : "Draf"}
        </Badge>
        <p className={styles.statusText}>
          {isEdit
            ? `${STATUS_NOTE[course.status]} Menyimpan tidak mengubah status kursus.`
            : "Kursus baru selalu disimpan sebagai draf dan belum tayang."}
        </p>
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Menyimpan…"
            : isEdit
              ? "Simpan Perubahan"
              : "Simpan sebagai Draf"}
        </Button>
        <Link
          href="/admin/courses"
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
