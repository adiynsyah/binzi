"use server";

import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses, lessons } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  lessonCreateSchema,
  type LessonCreateFieldErrors,
  type LessonCreateState,
} from "../schemas/lesson-create.schema";

/**
 * BINZI Lesson Create server action (TASK 025, CMS Spec §8, Blueprint
 * §17/§18).
 *
 * Mutation order per the approved Mutation Pattern: authenticate →
 * authorize → validate → load/verify target → generate server-owned
 * values → execute → safe result.
 *
 * - The action is bound to the course id by the lessons/new page
 *   (server-side), so the course binding is never client-controlled
 *   input (no hidden field, no IDOR surface). A UUID guard and a
 *   database existence check still fail closed.
 * - `status` is forced to DRAFT and publishedAt is never set: creation
 *   can never publish (CMS §8 "A new Lesson starts as Draft"; the
 *   Lesson publish workflow is a later task, not TASK 025).
 * - `slug` is SYSTEM-GENERATED from the title (same convention as the
 *   Course slug, TASK 023): the database requires NOT NULL +
 *   UNIQUE(course_id, slug) while CMS §8 defines no slug input. A
 *   collision with an existing lesson slug IN THE SAME COURSE is
 *   rejected with an actionable error on the title. The database
 *   unique constraint remains the race-safe authority (23505).
 * - `sortOrder` is server-owned: the initial position is appended at
 *   the end of the course's lesson list (max + 1), keeping the BR
 *   §3.2 dense 1..N ordering. Reordering belongs to TASK 026 and is
 *   not accepted from the client.
 * - Published-course guard (Decisions Log #11: a published course's
 *   lesson structure is immutable in V1): the course row is locked
 *   with SELECT ... FOR UPDATE inside the transaction and its status
 *   re-checked, so a course published after the page rendered can
 *   still not receive lessons (fail closed, zero writes).
 * - The lock also serializes concurrent lesson creates for the same
 *   course, making the max+1 append race-safe; the
 *   UNIQUE(course_id, sort_order) constraint is the final authority.
 * - ONLY the lessons table is written — no side-effect writes to
 *   courses, contents, lesson_contents, quizzes, or questions.
 * - Raw database errors are never shown to users (CMS §45): details
 *   go to server logs, users get a generic retry message.
 * - Success redirects to the Course Builder
 *   (/admin/courses/[id]/edit, TASK 024), where the new draft lesson
 *   appears at the end of the Lessons panel.
 */

/** Postgres unique-constraint violation code. */
const UNIQUE_VIOLATION_CODE = "23505";

const COURSE_SLUG_UNIQUE = "lessons_course_slug_unique";
const COURSE_SORT_ORDER_UNIQUE = "lessons_course_sort_order_unique";

/** Slug length bound: matches the TASK 018/019/023 slug max. */
const SLUG_MAX_LENGTH = 200;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUniqueViolationOn(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE &&
    "constraint" in error &&
    (error as { constraint?: unknown }).constraint === constraint
  );
}

function fieldErrorsFromIssues(
  issues: { path: PropertyKey[]; message: string }[],
): LessonCreateFieldErrors {
  const errors: LessonCreateFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as
      | keyof LessonCreateFieldErrors
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

const NOT_FOUND_MESSAGE = "Kursus tidak ditemukan atau sudah dihapus.";

const COURSE_PUBLISHED_MESSAGE =
  "Kursus ini sudah terbit — struktur pelajarannya terkunci dan tidak dapat ditambah (Keputusan #11).";

const SLUG_TAKEN_ERROR =
  "Judul menghasilkan slug yang sudah digunakan pelajaran lain di kursus ini. Ubah judul.";

type CreateLessonResult =
  | { kind: "inserted" }
  | { kind: "not-found" }
  | { kind: "published" }
  | { kind: "slug-taken" };

export async function createLessonAction(
  courseId: string,
  _prev: LessonCreateState,
  formData: FormData,
): Promise<LessonCreateState> {
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
      message: "Anda tidak memiliki izin untuk membuat pelajaran.",
    };
  }

  // 3. Validate — Zod at the boundary (Blueprint §14).
  const parsed = lessonCreateSchema.safeParse({
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrorsFromIssues(parsed.error.issues),
    };
  }

  const { title, description } = parsed.data;

  // 4. Guard the server-bound course id (fail closed on malformed).
  if (!UUID_PATTERN.test(courseId)) {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }

  // 5. Generate the server-owned slug from the title (CMS §8/TASK 023
  //    convention). A title without any slug-able character cannot
  //    produce a valid slug.
  const slug = slugifyTitle(title);
  if (slug === "") {
    return {
      status: "error",
      errors: {
        title: "Judul harus mengandung huruf atau angka untuk membuat slug.",
      },
    };
  }

  // 6. Execute — one transaction: lock the course row (serializes the
  //    max+1 append and re-checks publish state under the lock, Decisions
  //    #11), pre-check the per-course slug, derive the initial position,
  //    insert DRAFT. Only the lessons table is written.
  let result: CreateLessonResult;
  try {
    result = await db.transaction(async (tx) => {
      const [course] = await tx
        .select({ id: courses.id, status: courses.status })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (!course) {
        return { kind: "not-found" } as const;
      }
      if (course.status === "PUBLISHED") {
        return { kind: "published" } as const;
      }

      // Per-course slug conflict pre-check for a friendly field-level
      // message. The database unique constraint remains the authority.
      const slugTaken = await tx
        .select({ id: lessons.id })
        .from(lessons)
        .where(and(eq(lessons.courseId, courseId), eq(lessons.slug, slug)))
        .limit(1);

      if (slugTaken.length > 0) {
        return { kind: "slug-taken" } as const;
      }

      // Initial position: append at the end (max + 1) — BR §3.2 dense
      // 1..N ordering, owned by the server.
      const [last] = await tx
        .select({ sortOrder: lessons.sortOrder })
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
        .orderBy(desc(lessons.sortOrder))
        .limit(1);

      const nextSortOrder = (last?.sortOrder ?? 0) + 1;

      await tx.insert(lessons).values({
        courseId,
        title,
        slug,
        description,
        sortOrder: nextSortOrder,
        status: "DRAFT",
      });

      return { kind: "inserted" } as const;
    });
  } catch (error) {
    if (isUniqueViolationOn(error, COURSE_SLUG_UNIQUE)) {
      return {
        status: "error",
        errors: { title: SLUG_TAKEN_ERROR },
      };
    }
    if (isUniqueViolationOn(error, COURSE_SORT_ORDER_UNIQUE)) {
      // Unreachable while the course-row lock is held; fail safe with
      // a retry message instead of surfacing the raw error.
      console.error("[lessons/create] sort_order conflict:", error);
      return {
        status: "error",
        message: "Gagal menyimpan pelajaran. Silakan coba lagi.",
      };
    }
    console.error("[lessons/create] insert failed:", error);
    return {
      status: "error",
      message: "Gagal menyimpan pelajaran. Silakan coba lagi.",
    };
  }

  if (result.kind === "not-found") {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }
  if (result.kind === "published") {
    return { status: "error", message: COURSE_PUBLISHED_MESSAGE };
  }
  if (result.kind === "slug-taken") {
    return {
      status: "error",
      errors: { title: SLUG_TAKEN_ERROR },
    };
  }

  // 7. Success — back to the Course Builder (TASK 024); the new draft
  //    lesson appears at the end of the Lessons panel. redirect()
  //    throws, so no state is returned.
  redirect(`/admin/courses/${courseId}/edit`);
}
