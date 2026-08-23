"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { contents } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  validateContentForPublish,
  type ContentPublishState,
} from "../schemas/content-publish.schema";

/**
 * BINZI Content Publish server action (TASK 020, CMS Spec §18/§30,
 * Business Rules §22, Blueprint §33–§34).
 *
 * Publishing is an explicit server-side operation (Business Rules
 * §22: "Publishing is always explicit"). Mutation order per the
 * approved pattern: authenticate → authorize ADMIN → load the
 * authoritative row → validate the PERSISTED content against CMS §18
 * → perform one atomic status transition → redirect.
 *
 * - The action validates what is in the DATABASE, not what the admin
 *   may have typed into an unsaved edit form: the CMS §30 workflow is
 *   Edit → Save → … → Publish, so publish always evaluates the saved
 *   draft. The content id is bound server-side by the edit page.
 * - Atomicity: a single UPDATE flips status DRAFT→PUBLISHED and sets
 *   published_at + updated_by together, guarded by `status = 'DRAFT'`
 *   so a concurrent publish can never double-apply. The DB CHECK
 *   `contents_published_at_check` (PUBLISHED ⇒ published_at NOT NULL)
 *   is satisfied by construction.
 * - published_at semantics: "populated when status is PUBLISHED"
 *   (Drizzle Spec §20). No spec defines a "last published at"
 *   meaning, so an already-PUBLISHED row is REJECTED without any
 *   change — republishing is not defined in V1 and this action does
 *   not invent a timestamp-overwrite semantic. The UI therefore only
 *   offers the publish button on DRAFT rows.
 * - updatedBy is the authenticated ADMIN; createdBy/createdAt/metadata
 *   and every content field are untouched by this action.
 * - Invalid content stays exactly as it was: validation failures
 *   return before the UPDATE, producing zero DB mutation.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_FOUND_MESSAGE = "Konten tidak ditemukan atau sudah dihapus.";
const ALREADY_PUBLISHED_MESSAGE = "Konten sudah diterbitkan.";

/**
 * State returned by the publish action lives in
 * content-publish.schema.ts — a "use server" file may only export
 * async functions.
 */

export async function publishContentAction(
  contentId: string,
  _prev: ContentPublishState,
  _formData: FormData,
): Promise<ContentPublishState> {
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
      message: "Anda tidak memiliki izin untuk menerbitkan konten.",
    };
  }

  // 3. Load the authoritative row — publish validates persisted data.
  if (!UUID_PATTERN.test(contentId)) {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }

  const rows = await db
    .select({
      id: contents.id,
      title: contents.title,
      slug: contents.slug,
      type: contents.type,
      status: contents.status,
      body: contents.body,
      metadata: contents.metadata,
    })
    .from(contents)
    .where(eq(contents.id, contentId))
    .limit(1);

  const target = rows[0];
  if (!target) {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }

  // 4. Already published → reject without any change (see header).
  if (target.status === "PUBLISHED") {
    return { status: "error", message: ALREADY_PUBLISHED_MESSAGE };
  }

  // 5. Validate the persisted content (CMS §18).
  const errors = validateContentForPublish(target);
  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Konten belum memenuhi syarat untuk diterbitkan.",
      errors,
    };
  }

  // 6. Atomic publish: one guarded UPDATE, all fields together.
  try {
    const updated = await db
      .update(contents)
      .set({
        status: "PUBLISHED",
        publishedAt: new Date(),
        updatedBy: user.id,
      })
      .where(and(eq(contents.id, contentId), eq(contents.status, "DRAFT")))
      .returning({ id: contents.id });

    if (updated.length === 0) {
      // The row was not a DRAFT anymore (concurrent publish/unpublish).
      return { status: "error", message: ALREADY_PUBLISHED_MESSAGE };
    }
  } catch (error) {
    console.error("[contents/publish] update failed:", error);
    return {
      status: "error",
      message: "Gagal menerbitkan konten. Silakan coba lagi.",
    };
  }

  // 7. Success — back to the edit page, which now shows the
  //    published state (and no longer renders the publish form).
  redirect(`/admin/contents/${contentId}/edit`);
}
