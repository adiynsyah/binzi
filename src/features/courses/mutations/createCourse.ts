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
 * BINZI Course Create server action (TASK 023, CMS Spec §6, Blueprint
 * §17/§18).
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → generate server-controlled values → execute →
 * safe result.
 *
 * - Authentication uses the Supabase server client (cookie session
 *   validated by Supabase Auth); authorization re-reads the role from
 *   public.users via isUserAdmin (TASK 014). The role is never taken
 *   from the client. Both fail closed.
 * - `status` is forced to DRAFT and publishedAt is never set: creation
 *   can never publish (CMS §6 "A newly created Course is always Draft";
 *   the client cannot choose PUBLISHED — the field is not even part of
 *   the input schema). Publishing belongs to a later task, not 023.
 * - Slug is SYSTEM-GENERATED from the title (CMS §6 "Automatically
 *   generated: Slug"), normalized with the project's kebab-case slug
 *   convention (same vocabulary as TASK 018/019 slugs). A collision
 *   with an existing course slug is rejected with an actionable error
 *   on the title — the established Content behavior (no silent
 *   overwrite, no client-supplied slug, no auto-renaming). The
 *   database unique constraint remains the race-safe authority (23505).
 * - id/createdAt/updatedAt are database-generated defaults.
 * - Raw database errors are never shown to users (CMS §45): details go
 *   to server logs, users get a generic retry message.
 * - Success redirects to /admin/courses, where the new draft sorts to
 *   the top of the list (updatedAt DESC, TASK 022).
 */

/** Postgres unique-constraint violation code. */
const UNIQUE_VIOLATION_CODE = "23505";

/** Slug length bound: matches the TASK 018/019 slug max. */
const SLUG_MAX_LENGTH = 200;

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

/** Kebab-case slug from a title (ASCII: diacritics folded, rest dashed). */
function slugifyTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

const SLUG_TAKEN_ERROR =
  "Judul menghasilkan slug yang sudah digunakan kursus lain. Ubah judul.";

export async function createCourseAction(
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
      message: "Anda tidak memiliki izin untuk membuat kursus.",
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

  const { title, description, thumbnailUrl, difficulty, estimatedDuration } =
    parsed.data;

  // 4. Generate the server-owned slug from the title (CMS §6). A title
  //    without any slug-able character cannot produce a valid slug.
  const slug = slugifyTitle(title);
  if (slug === "") {
    return {
      status: "error",
      errors: {
        title: "Judul harus mengandung huruf atau angka untuk membuat slug.",
      },
    };
  }

  // 5. Slug conflict pre-check for a friendly field-level message.
  //    The database unique constraint remains the authority.
  const slugTaken = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  if (slugTaken.length > 0) {
    return {
      status: "error",
      errors: { title: SLUG_TAKEN_ERROR },
    };
  }

  // 6. Execute — status forced to DRAFT; publishedAt/id/timestamps are
  //    database defaults and are never set here.
  try {
    await db.insert(courses).values({
      title,
      slug,
      description,
      thumbnailUrl,
      difficulty,
      estimatedDuration,
      status: "DRAFT",
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        errors: { title: SLUG_TAKEN_ERROR },
      };
    }
    console.error("[courses/create] insert failed:", error);
    return {
      status: "error",
      message: "Gagal menyimpan kursus. Silakan coba lagi.",
    };
  }

  // 7. Success — back to the Course List (TASK 022); the new draft
  //    appears at the top. redirect() throws, so no state is returned.
  redirect("/admin/courses");
}
