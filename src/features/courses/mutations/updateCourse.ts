"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  courseMetadataSchema,
  type CourseMetadataFieldErrors,
  type CourseMetadataState,
} from "../schemas/course-metadata.schema";

/**
 * BINZI Course Edit server action (TASK 023, CMS Spec §6/§7, Blueprint
 * §17/§18).
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → load/verify target → update → safe result.
 * The action is bound to the course id by the edit page (server-side),
 * so the id is never client-controlled input.
 *
 * Editability rule from the authoritative specs (do not invent more):
 * Business Rules §24 — "Published entities may be edited according to
 * their type and current relationships" — and BR explicitly speaks of
 * "ordinary Course edits" without recalculation side effects, so BOTH
 * DRAFT and PUBLISHED courses are editable. Saving NEVER transitions
 * anything server-owned:
 *
 * - `status` and `publishedAt` are not in the SET clause (Business
 *   Rules §22 "Publishing is always explicit"; the Course publish/
 *   unpublish workflow belongs to a later task, not TASK 023).
 * - `slug` is not in the SET clause: it is system-generated once at
 *   creation (CMS §6) and immutable afterwards — the slug is the
 *   future public /courses/[slug] identity (Drizzle schema comment),
 *   so a metadata edit can never silently break or reassign it
 *   (same preservation rule as TASK 019 slugs).
 * - `createdAt` is never written; `updatedAt` is maintained by the
 *   schema's $onUpdate.
 *
 * The course table has no created_by/updated_by columns (unlike
 * contents), so there is no audit stamp to set here.
 *
 * Raw database errors are never shown to users (CMS §45). Success
 * redirects to /admin/courses, where the edited row sorts by
 * updatedAt DESC (TASK 022).
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldErrorsFromIssues(
  issues: { path: PropertyKey[]; message: string }[],
): CourseMetadataFieldErrors {
  const errors: CourseMetadataFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as
      | keyof CourseMetadataFieldErrors
      | undefined;
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

const NOT_FOUND_MESSAGE = "Kursus tidak ditemukan atau sudah dihapus.";

export async function updateCourseAction(
  courseId: string,
  _prev: CourseMetadataState,
  formData: FormData,
): Promise<CourseMetadataState> {
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
      message: "Anda tidak memiliki izin untuk menyunting kursus.",
    };
  }

  // 3. Validate — Zod at the boundary (Blueprint §14).
  const parsed = courseMetadataSchema.safeParse({
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    thumbnailUrl: formValue(formData, "thumbnailUrl"),
    difficulty: formValue(formData, "difficulty"),
    estimatedDuration: formValue(formData, "estimatedDuration"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrorsFromIssues(parsed.error.issues),
    };
  }

  if (!UUID_PATTERN.test(courseId)) {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }

  // 4. Load/verify the target. Both DRAFT and PUBLISHED courses are
  //    editable (Business Rules §24) — no status gate exists.
  const targetRows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (targetRows.length === 0) {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }

  // 5. Execute — only the editable metadata fields; slug, status,
  //    published_at, and created_at are never written here.
  try {
    const updated = await db
      .update(courses)
      .set({
        title: parsed.data.title,
        description: parsed.data.description,
        thumbnailUrl: parsed.data.thumbnailUrl,
        difficulty: parsed.data.difficulty,
        estimatedDuration: parsed.data.estimatedDuration,
      })
      .where(eq(courses.id, courseId))
      .returning({ id: courses.id });

    if (updated.length === 0) {
      return { status: "error", message: NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    console.error("[courses/update] update failed:", error);
    return {
      status: "error",
      message: "Gagal menyimpan kursus. Silakan coba lagi.",
    };
  }

  // 6. Success — back to the Course List (TASK 022).
  redirect("/admin/courses");
}
