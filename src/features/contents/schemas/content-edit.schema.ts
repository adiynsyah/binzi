import type { JSONContent } from "@tiptap/core";
import { z } from "zod";

import { contentType } from "@/db/schema/enums";

/**
 * Content Edit validation (TASK 019, Blueprint §14/§17/§21, CMS §14/§17).
 *
 * Mirrors the create schema (TASK 018) with one documented difference
 * driven by the approved schema, not by preference:
 *
 * - Slug may be submitted EMPTY on edit. `contents.slug` is nullable
 *   and "UNIQUE for non-null values" (Drizzle Spec §8, Decisions Log
 *   #5), and 5 of the 8 seed rows legitimately have NULL slugs — an
 *   edit must not force admins to invent slugs for existing content
 *   just to fix a typo. The mutation decides what an empty slug means:
 *   NULL is preserved when the row already has no slug; a row WITH a
 *   slug must keep one (an empty submit is rejected) so a published
 *   article can never silently lose its /articles/[slug] URL.
 *
 * Non-empty values follow the exact TASK 018 rules: trim, max 200,
 * URL-path-segment kebab-case. `status` is deliberately NOT part of
 * the schema — saving never publishes or unpublishes (Business Rules
 * §22 "Publishing is always explicit"; publishing is TASK 020).
 */

/** URL-path-segment slug: lowercase letters, digits, single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same pattern, but also accepts the empty string (see header). */
const SLUG_OR_EMPTY_PATTERN = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

/**
 * Top-level Tiptap document shape, identical to TASK 018: nested
 * nodes pass through untouched so the stored JSON round-trips the
 * editor document exactly.
 */
const tiptapDocSchema = z.looseObject({
  type: z.literal("doc", { error: "Isi konten harus berupa dokumen Tiptap." }),
  content: z.array(z.looseObject({ type: z.string().min(1) })).optional(),
});

export const contentEditSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  slug: z
    .string()
    .trim()
    .max(200, "Slug maksimal 200 karakter.")
    .regex(
      SLUG_OR_EMPTY_PATTERN,
      "Slug hanya boleh huruf kecil, angka, dan tanda hubung (contoh: panduan-gizi).",
    ),
  type: z.enum(contentType.enumValues, {
    error: "Tipe konten tidak valid.",
  }),
  body: tiptapDocSchema,
});

export type ContentEditInput = z.infer<typeof contentEditSchema>;

/** True when a slug value is a non-empty valid kebab-case slug. */
export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export type ContentEditField = "title" | "slug" | "type" | "body";

export type ContentEditFieldErrors = Partial<
  Record<ContentEditField, string>
>;

/**
 * State returned by the edit server action and consumed by the form
 * via `useActionState`. Successful saves never return a state — the
 * action redirects to the Content List, mirroring TASK 018.
 */
export type ContentEditState =
  | { status: "idle" }
  | {
      status: "error";
      /** Per-field validation messages. */
      errors?: ContentEditFieldErrors;
      /** Form-level message (auth, permission, missing content, storage). */
      message?: string;
    };

export const initialContentEditState: ContentEditState = { status: "idle" };

/** Editable content shape handed to the form (from getContentById). */
export type EditableContent = {
  id: string;
  title: string;
  slug: string | null;
  type: (typeof contentType.enumValues)[number];
  status: "DRAFT" | "PUBLISHED";
  /** Read-only display field (status note, TASK 021 preview date line). */
  publishedAt: Date | null;
  body: JSONContent;
};
