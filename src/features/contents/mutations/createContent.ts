"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { contents } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  contentCreateSchema,
  type ContentCreateField,
  type ContentCreateFieldErrors,
  type ContentCreateState,
} from "../schemas/content-create.schema";

/**
 * BINZI Content Create server action (TASK 018, Blueprint §17/§18,
 * CMS Spec §14/§17/§35).
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → execute → safe result.
 *
 * - Authentication uses the Supabase server client (cookie session
 *   validated by Supabase Auth); authorization re-reads the role from
 *   public.users via isUserAdmin (TASK 014). The role is never taken
 *   from the client. Both fail closed.
 * - `status` is forced to DRAFT and publishedAt is never set: creation
 *   can never publish (the client cannot choose PUBLISHED — the field
 *   is not even part of the input schema).
 * - created_by/updated_by come from the authenticated user id.
 * - Slug conflicts surface as a field-level error (Decisions Log #5
 *   non-null uniqueness). The pre-check gives the friendly message;
 *   the unique constraint is the race-safe authority (23505).
 * - Raw database errors are never shown to users (CMS §45): details
 *   go to server logs, users get a generic retry message.
 * - Success redirects to /admin/contents, where the new draft sorts
 *   to the top of the list (updatedAt DESC) — visible confirmation
 *   without a duplicate-submit-prone success page.
 */

/** Postgres unique-constraint violation code. */
const UNIQUE_VIOLATION_CODE = "23505";

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
): ContentCreateFieldErrors {
  const errors: ContentCreateFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as ContentCreateField | undefined;
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

export async function createContentAction(
  _prev: ContentCreateState,
  formData: FormData,
): Promise<ContentCreateState> {
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
      message: "Anda tidak memiliki izin untuk membuat konten.",
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

  const parsed = contentCreateSchema.safeParse({
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

  // 4. Slug conflict pre-check for a friendly field-level message.
  //    The database unique constraint remains the authority.
  const slugTaken = await db
    .select({ id: contents.id })
    .from(contents)
    .where(eq(contents.slug, slug))
    .limit(1);

  if (slugTaken.length > 0) {
    return {
      status: "error",
      errors: { slug: "Slug sudah digunakan konten lain." },
    };
  }

  // 5. Execute — status forced to DRAFT; publishedAt never set here.
  try {
    await db.insert(contents).values({
      title,
      slug,
      type,
      body,
      status: "DRAFT",
      createdBy: user.id,
      updatedBy: user.id,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        errors: { slug: "Slug sudah digunakan konten lain." },
      };
    }
    console.error("[contents/create] insert failed:", error);
    return {
      status: "error",
      message: "Gagal menyimpan konten. Silakan coba lagi.",
    };
  }

  // 6. Success — back to the Content List; the new draft appears at
  //    the top. redirect() throws, so no state is returned.
  redirect("/admin/contents");
}
