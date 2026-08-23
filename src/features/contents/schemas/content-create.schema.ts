import type { JSONContent } from "@tiptap/core";
import { z } from "zod";

import { contentType } from "@/db/schema/enums";

/**
 * Content Create validation (TASK 018, Blueprint §14/§17/§21, CMS §14).
 *
 * Field set is exactly the TASK 018 requirement list — Title, Slug,
 * Type, Body. `status` is deliberately NOT part of the schema: the
 * server action forces DRAFT and never accepts a client value.
 *
 * "Metadata required by schema" resolved against the approved schema:
 * `contents.metadata` is JSONB NULL "reserved for type-specific
 * metadata" (Drizzle Spec §8) — nothing in the approved schema is
 * required at creation, and drafts may be incomplete (CMS §17), so no
 * metadata fields are collected and none are invented here. The
 * schema-required created_by/updated_by are set server-side from the
 * authenticated user, never from the form.
 *
 * Slug: the specs define only non-null uniqueness (Decisions Log #5);
 * no normalization rule exists, so invalid formats are rejected with
 * an actionable message instead of being silently rewritten. The
 * format keeps slugs usable as /articles/[slug] path segments.
 *
 * Body: structural validation of the Tiptap JSON document (Blueprint
 * §21 "Zod validation / normalization"). looseObject preserves all
 * node attributes and marks — the document is stored exactly as the
 * editor produced it.
 */

/** URL-path-segment slug: lowercase letters, digits, single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Top-level Tiptap document shape. Nested nodes are intentionally not
 * recursively validated — they pass through untouched so the stored
 * JSON round-trips the editor document exactly.
 */
const tiptapDocSchema = z.looseObject({
  type: z.literal("doc", { error: "Isi konten harus berupa dokumen Tiptap." }),
  content: z.array(z.looseObject({ type: z.string().min(1) })).optional(),
});

export const contentCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug wajib diisi.")
    .max(200, "Slug maksimal 200 karakter.")
    .regex(
      SLUG_PATTERN,
      "Slug hanya boleh huruf kecil, angka, dan tanda hubung (contoh: panduan-gizi).",
    ),
  type: z.enum(contentType.enumValues, {
    error: "Tipe konten tidak valid.",
  }),
  body: tiptapDocSchema,
});

export type ContentCreateInput = z.infer<typeof contentCreateSchema>;

/** Validated body type — full Tiptap document (extra keys preserved). */
export type ContentBody = JSONContent;

export type ContentCreateField = "title" | "slug" | "type" | "body";

export type ContentCreateFieldErrors = Partial<
  Record<ContentCreateField, string>
>;

/**
 * State returned by the create server action and consumed by the
 * form via `useActionState`. Successful creation never returns a
 * state — the action redirects to the Content List, mirroring the
 * loginAction pattern.
 */
export type ContentCreateState =
  | { status: "idle" }
  | {
      status: "error";
      /** Per-field validation messages. */
      errors?: ContentCreateFieldErrors;
      /** Form-level message (auth, permission, storage failure). */
      message?: string;
    };

export const initialContentCreateState: ContentCreateState = {
  status: "idle",
};
