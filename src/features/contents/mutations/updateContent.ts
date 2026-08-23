"use server";

import { eq, ne, and } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { contents } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  contentEditSchema,
  type ContentEditField,
  type ContentEditFieldErrors,
  type ContentEditState,
} from "../schemas/content-edit.schema";

/**
 * BINZI Content Edit server action (TASK 019, Blueprint §17/§18,
 * CMS Spec §14/§17/§35).
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → load/verify target → business rules →
 * update → safe result. The action is bound to the content id by the
 * edit page (server-side), so the id is never client-controlled
 * input; every other server-controlled field behaves the same:
 *
 * - Authentication via the Supabase server client (cookie session);
 *   authorization re-reads the role from public.users via
 *   isUserAdmin (TASK 014). Both fail closed. The proxy protecting
 *   /admin/* is NOT relied upon here.
 *
 * Editability rule from the authoritative specs (do not invent more):
 * Business Rules §4.5 — Draft content "Can be edited"; §24 —
 * "Published entities may be edited according to their type and
 * current relationships" (the only published-entity restriction in
 * V1 is Lesson deletion); CMS §17 — Draft "Editable", Published
 * "Editable according to V1 workflow". Both statuses are therefore
 * editable, and saving NEVER transitions status: status,
 * published_at, metadata, created_by, and created_at are not in the
 * SET clause. Publishing is always explicit (Business Rules §22)
 * and belongs to TASK 020.
 *
 * - updatedBy comes from the authenticated user id; updatedAt is
 *   maintained by the schema's $onUpdate.
 * - Slug: non-empty values follow the TASK 018 rules; an empty
 *   submit preserves a NULL slug but is rejected for rows that
 *   already have one (see content-edit.schema.ts for the rationale).
 *   Uniqueness excludes the row itself; the friendly pre-check is
 *   backed by the unique constraint (23505) for races.
 * - Raw database errors are never shown to users (CMS §45).
 * - Success redirects to /admin/contents, where the edited row
 *   sorts by updatedAt DESC (TASK 016).
 */

/** Postgres unique-constraint violation code. */
const UNIQUE_VIOLATION_CODE = "23505";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

function fieldErrorsFromIssues(
  issues: { path: PropertyKey[]; message: string }[],
): ContentEditFieldErrors {
  const errors: ContentEditFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as ContentEditField | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function formValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

const NOT_FOUND_MESSAGE = "Konten tidak ditemukan atau sudah dihapus.";

export async function updateContentAction(
  contentId: string,
  _prev: ContentEditState,
  formData: FormData,
): Promise<ContentEditState> {
  // 1. Authenticate — Supabase cookie session, validated server-side.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "Sesi tidak valid. Silakan masuk kembali.",
    };
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return {
      status: "error",
      message: "Anda tidak memiliki izin untuk menyunting konten.",
    };
  }

  // 3. Validate — Zod at the boundary (Blueprint §14). The editor
  //    submits its JSON document as a serialized hidden field.
  const rawBody = formValue(formData, "body");
  let parsedBody: unknown;
  if (rawBody === undefined || rawBody === "") {
    return {
      status: "error",
      errors: { body: "Isi konten wajib dikirim." },
    };
  }
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return {
      status: "error",
      errors: { body: "Isi konten tidak valid." },
    };
  }

  const parsed = contentEditSchema.safeParse({
    title: formValue(formData, "title"),
    slug: formValue(formData, "slug"),
    type: formValue(formData, "type"),
    body: parsedBody,
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrorsFromIssues(parsed.error.issues),
    };
  }

  const { title, slug, type, body } = parsed.data;

  if (!UUID_PATTERN.test(contentId)) {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }

  // 4. Load/verify the target. Both DRAFT and PUBLISHED are editable
  //    (Business Rules §4.5/§24, CMS §17) — no status gate exists.
  const targetRows = await db
    .select({ id: contents.id, slug: contents.slug })
    .from(contents)
    .where(eq(contents.id, contentId))
    .limit(1);

  const target = targetRows[0];
  if (!target) {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }

  // 5. Slug business rule: empty preserves NULL, but a row that has
  //    a slug must keep one.
  let nextSlug: string | null;
  if (slug === "") {
    if (target.slug !== null) {
      return {
        status: "error",
        errors: { slug: "Slug wajib diisi." },
      };
    }
    nextSlug = null;
  } else {
    nextSlug = slug;
    const taken = await db
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.slug, nextSlug), ne(contents.id, contentId)))
      .limit(1);
    if (taken.length > 0) {
      return {
        status: "error",
        errors: { slug: "Slug sudah digunakan konten lain." },
      };
    }
  }

  // 6. Execute — only the editable fields; status/published_at/
  //    metadata/created_by/created_at are never written here.
  try {
    const updated = await db
      .update(contents)
      .set({
        title,
        slug: nextSlug,
        type,
        body,
        updatedBy: user.id,
      })
      .where(eq(contents.id, contentId))
      .returning({ id: contents.id });

    if (updated.length === 0) {
      return { status: "error", message: NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        errors: { slug: "Slug sudah digunakan konten lain." },
      };
    }
    console.error("[contents/update] update failed:", error);
    return {
      status: "error",
      message: "Gagal menyimpan konten. Silakan coba lagi.",
    };
  }

  // 7. Success — back to the Content List (TASK 016).
  redirect("/admin/contents");
}
