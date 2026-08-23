import { contentType } from "@/db/schema/enums";

/**
 * Content Publish validation (TASK 020, CMS Spec §18 "Content Publish
 * Validation", Blueprint §33–§34).
 *
 * The authoritative rules, quoted from CMS §18 ("Before publishing
 * Content"):
 *
 * - "Title must exist"
 * - "Required content body must be valid"
 * - "Content-Type-specific required metadata must exist"
 * - "Slug must be valid where required"
 *
 * What those rules concretely mean for BINZI (each mapping traceable
 * to a spec, nothing invented):
 *
 * 1. Title exists → non-empty after trim. `contents.title` is NOT
 *    NULL, so this only fails for whitespace-only titles.
 *
 * 2. Body valid → a Tiptap document (`type: "doc"`), the exact shape
 *    TASK 018/019 already validate at save time. All Content types
 *    carry a body (schema NOT NULL).
 *
 * 3. Type-specific metadata → only VIDEO has required metadata in the
 *    authoritative specs: CMS §14 defines the VIDEO fields as Title +
 *    "Video Provider" + "Video ID / URL", and the CMS §18 failure
 *    example is literally a missing video URL ("Cannot publish this
 *    video. Missing: • Video URL"). The approved seed stores VIDEO
 *    metadata as { provider, videoId } and shows every OTHER type
 *    (ARTICLE/INFOGRAPHIC/TEXT/TIP) published with metadata NULL —
 *    so no other type has a metadata requirement.
 *
 * 4. Slug "where required" → only ARTICLE requires one: CMS §14 lists
 *    Slug as a core ARTICLE field, and Decisions Log #5 says
 *    "Published Articles use /articles/[slug] and therefore require
 *    deterministic slug resolution". The approved seed publishes
 *    VIDEO/TEXT/TIP/INFOGRAPHIC with NULL slugs (they are consumed
 *    inside Lessons, not standalone), so a slug is NOT required for
 *    those types. When any non-article row does carry a slug, it must
 *    still be a valid URL-path slug (the TASK 018/019 kebab-case
 *    pattern) because /articles/[slug] resolves it.
 *
 * This module is a PURE function over the AUTHORITATIVE database row
 * — publish validates what is persisted, never client-submitted
 * fields (the caller loads the row server-side).
 */

/** URL-path-segment slug: lowercase letters, digits, single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ContentPublishField = "title" | "body" | "slug" | "metadata";

export type ContentPublishFieldErrors = Partial<
  Record<ContentPublishField, string>
>;

/**
 * State returned by the publish server action and consumed by the
 * publish form via `useActionState`. Successful publishes never
 * return a state — the action redirects back to the edit page, where
 * the status badge now shows the published state.
 */
export type ContentPublishState =
  | { status: "idle" }
  | {
      status: "error";
      /** Form-level message (auth, permission, missing, already published). */
      message?: string;
      /** Actionable per-field validation errors (CMS §18). */
      errors?: ContentPublishFieldErrors;
    };

export const initialContentPublishState: ContentPublishState = {
  status: "idle",
};

/**
 * The authoritative row shape publish validation runs against.
 * body/metadata are `unknown` because they come straight from JSONB.
 */
export type PublishableContentRow = {
  title: string;
  slug: string | null;
  type: (typeof contentType.enumValues)[number];
  body: unknown;
  metadata: unknown;
};

function isTiptapDoc(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "doc"
  );
}

/**
 * VIDEO metadata rule (CMS §14/§18): provider + videoId must exist as
 * non-empty strings — the persisted seed shape { provider, videoId }.
 */
function videoMetadataErrors(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return "Konten video wajib memiliki provider dan ID video sebelum diterbitkan.";
  }
  const { provider, videoId } = metadata as {
    provider?: unknown;
    videoId?: unknown;
  };
  if (
    typeof provider !== "string" ||
    provider.trim().length === 0 ||
    typeof videoId !== "string" ||
    videoId.trim().length === 0
  ) {
    return "Konten video wajib memiliki provider dan ID video sebelum diterbitkan.";
  }
  return undefined;
}

/**
 * Validate an authoritative Content row for publishing.
 * Returns {} when the row satisfies every CMS §18 rule.
 */
export function validateContentForPublish(
  content: PublishableContentRow,
): ContentPublishFieldErrors {
  const errors: ContentPublishFieldErrors = {};

  // 1. Title must exist.
  if (content.title.trim().length === 0) {
    errors.title = "Judul wajib diisi sebelum menerbitkan.";
  }

  // 2. Required content body must be valid (a Tiptap document).
  if (!isTiptapDoc(content.body)) {
    errors.body = "Isi konten harus berupa dokumen Tiptap yang valid sebelum diterbitkan.";
  }

  // 3. Content-Type-specific required metadata (VIDEO only).
  if (content.type === "VIDEO") {
    const message = videoMetadataErrors(content.metadata);
    if (message) {
      errors.metadata = message;
    }
  }

  // 4. Slug must be valid where required.
  if (content.type === "ARTICLE") {
    if (content.slug === null || content.slug.trim().length === 0) {
      errors.slug = "Artikel wajib memiliki slug sebelum diterbitkan (dipakai di URL /articles/…).";
    } else if (!SLUG_PATTERN.test(content.slug)) {
      errors.slug = "Slug artikel tidak valid — huruf kecil, angka, dan tanda hubung (contoh: panduan-gizi).";
    }
  } else if (content.slug !== null && content.slug.trim().length > 0) {
    if (!SLUG_PATTERN.test(content.slug)) {
      errors.slug = "Slug tidak valid — huruf kecil, angka, dan tanda hubung (contoh: panduan-gizi).";
    }
  }

  return errors;
}
