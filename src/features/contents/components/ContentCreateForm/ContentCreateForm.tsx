"use client";

import type { JSONContent } from "@tiptap/core";
import Link from "next/link";
import { useActionState, useState } from "react";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";
import { contentType } from "@/db/schema/enums";

import { TiptapEditor } from "../TiptapEditor/TiptapEditor";
import { createContentAction } from "../../mutations/createContent";
import { initialContentCreateState } from "../../schemas/content-create.schema";
import styles from "./ContentCreateForm.module.scss";

/**
 * BINZI Content Create form (TASK 018, CMS Spec §14/§17).
 *
 * Fields exactly per the approved Content Editor set for creation:
 * Title, Slug, Type, Body (TiptapEditor from TASK 017). Status is not
 * a field — creation always produces DRAFT, and the form says so.
 *
 * The editor document is mirrored into a hidden field as JSON; the
 * server action re-parses and validates it (Blueprint §21). All
 * validation is authoritative server-side; native attributes are only
 * a first gate.
 */

/** What a pristine empty Tiptap editor holds. */
const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/** Same labels as the Content List (TASK 016). */
const TYPE_LABELS: Record<(typeof contentType.enumValues)[number], string> = {
  ARTICLE: "Artikel",
  VIDEO: "Video",
  INFOGRAPHIC: "Infografis",
  TEXT: "Teks",
  TIP: "Tips",
};

export function ContentCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createContentAction,
    initialContentCreateState,
  );
  const [bodyDoc, setBodyDoc] = useState<JSONContent>(EMPTY_DOC);

  const errors = state.status === "error" ? state.errors : undefined;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.fields}>
        <Input
          label="Judul"
          name="title"
          required
          disabled={isPending}
          error={errors?.title}
        />
        <div className={styles.field}>
          <Input
            label="Slug"
            name="slug"
            required
            disabled={isPending}
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
            defaultValue="ARTICLE"
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
          <TiptapEditor
            content={null}
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
        <Badge tone="warning">Draf</Badge>
        <p className={styles.statusText}>
          Konten baru selalu disimpan sebagai draf dan tidak tampil publik.
        </p>
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan…" : "Simpan Draf"}
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
