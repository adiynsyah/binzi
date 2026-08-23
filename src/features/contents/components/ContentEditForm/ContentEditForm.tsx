"use client";

import type { JSONContent } from "@tiptap/core";
import Link from "next/link";
import { useActionState, useState } from "react";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";
import { contentType } from "@/db/schema/enums";
import type { ContentEditState, EditableContent } from "@/features/contents/schemas/content-edit.schema";

import { TiptapEditor } from "../TiptapEditor/TiptapEditor";
import styles from "./ContentEditForm.module.scss";

/**
 * BINZI Content Edit form (TASK 019, CMS Spec §14/§17).
 *
 * Mirrors the TASK 018 create form: Title, Slug, Type, Body —
 * pre-populated from the persisted record. Status is not a field:
 * saving never publishes or unpublishes (Business Rules §22), and
 * the status note says so. The action is bound to the content id by
 * the server page, so the id cannot be tampered with from the
 * client. All validation is authoritative server-side; native
 * attributes are only a first gate.
 */

/** Same labels as the Content List (TASK 016). */
const TYPE_LABELS: Record<(typeof contentType.enumValues)[number], string> = {
  ARTICLE: "Artikel",
  VIDEO: "Video",
  INFOGRAPHIC: "Infografis",
  TEXT: "Teks",
  TIP: "Tips",
};

const STATUS_NOTE: Record<"DRAFT" | "PUBLISHED", string> = {
  DRAFT: "Konten masih draf dan tidak tampil publik.",
  PUBLISHED: "Konten ini sudah terbit dan tampil publik.",
};

export function ContentEditForm({
  content,
  action,
}: {
  content: EditableContent;
  /** updateContentAction bound to the content id by the server page. */
  action: (state: ContentEditState, formData: FormData) => Promise<ContentEditState>;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    { status: "idle" } satisfies ContentEditState,
  );
  const [bodyDoc, setBodyDoc] = useState<JSONContent>(content.body);

  const errors = state.status === "error" ? state.errors : undefined;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.fields}>
        <Input
          label="Judul"
          name="title"
          required
          disabled={isPending}
          defaultValue={content.title}
          error={errors?.title}
        />
        <div className={styles.field}>
          <Input
            label="Slug"
            name="slug"
            required={content.slug !== null}
            disabled={isPending}
            defaultValue={content.slug ?? ""}
            error={errors?.slug}
          />
          <p className={styles.hint}>
            Huruf kecil, angka, dan tanda hubung — dipakai di URL artikel,
            contoh: panduan-gizi-seimbang
          </p>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="content-type">
            Tipe
          </label>
          <select
            id="content-type"
            name="type"
            className={errors?.type ? styles.selectInvalid : styles.select}
            defaultValue={content.type}
            disabled={isPending}
            aria-invalid={errors?.type ? true : undefined}
          >
            {contentType.enumValues.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABELS[value]}
              </option>
            ))}
          </select>
          {errors?.type ? (
            <p className={styles.fieldError}>{errors.type}</p>
          ) : null}
        </div>
        <div className={styles.field}>
          <p className={styles.fieldLabel}>Isi Konten</p>
          {/* key forces a fresh editor when navigating between contents:
              TiptapEditor's content prop is initial-only (TASK 017). */}
          <TiptapEditor
            key={content.id}
            content={content.body}
            label="Isi konten"
            onChange={setBodyDoc}
          />
          {errors?.body ? (
            <p className={styles.fieldError}>{errors.body}</p>
          ) : null}
        </div>
      </div>

      <input
        type="hidden"
        name="body"
        value={JSON.stringify(bodyDoc)}
        readOnly
      />

      <div className={styles.statusNote}>
        <Badge tone={content.status === "PUBLISHED" ? "success" : "warning"}>
          {content.status === "PUBLISHED" ? "Terbit" : "Draf"}
        </Badge>
        <p className={styles.statusText}>
          {STATUS_NOTE[content.status]} Menyimpan tidak mengubah status
          konten.
        </p>
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan…" : "Simpan Perubahan"}
        </Button>
        <Link
          href="/admin/contents"
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
