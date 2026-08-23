"use server";

import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { contents, courses, lessonContents, lessons } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

/**
 * BINZI Content Assignment server action (TASK 028, Task Plan
 * "Assign Content to Lesson", CMS Spec §10/§11, BR §4.2/§4.3/§25,
 * Decisions Log #3/#11).
 *
 * Assignment rules (all enforced server-side, fail closed):
 * - Course PUBLISHED → no structural change at all (Decisions #11);
 *   the status is re-checked under the course-row lock, so a stale
 *   form posted after publishing writes nothing (TOCTOU).
 * - The lesson must belong to the bound course — cross-course or
 *   unknown lessonIds die before any write.
 * - The Content must exist.
 * - The Content must not be assigned ANYWHERE: lesson_contents carries
 *   the global UNIQUE(content_id) — one Content belongs to at most one
 *   Lesson in V1 (BR §4.2/§4.3/§25, CMS §11, approved decision #3).
 *   The pre-insert check is the friendly layer; the constraint is the
 *   final authority, so a concurrent duplicate insert surfaces as
 *   Postgres 23505 → rollback → benign redirect (CMS §11 "the database
 *   constraint must reject it gracefully").
 *
 * Initial position (BR §3.2/§27, CMS §10 "order is meaningful and
 * must be persisted"): the new assignment is APPENDED with
 * sortOrder = MAX(existing) + 1 (1 for an empty lesson) — the same
 * append convention TASK 025 uses for new lessons. Reordering Content
 * within a lesson is TASK 029 and is deliberately NOT touched here.
 *
 * Lock ordering (deadlock-free, conventions of TASK 025/026/027 —
 * every course-scoped mutation takes the course-row lock first):
 * course row FOR UPDATE → lesson row FOR UPDATE (ownership re-check
 * under the lock) → the lesson's lesson_contents rows FOR UPDATE in
 * sort_order order, which serializes the MAX+1 computation against
 * concurrent assignments to the same lesson.
 *
 * Input contract — deliberately minimal. The client sends ONLY
 * `contentId`; the course AND lesson bindings come from the action's
 * server-side bind (never hidden fields). NOTHING else is read from
 * the payload: courseId, lessonId, sortOrder, status, userId, role,
 * timestamps, or any other server-owned field sent by the client is
 * ignored entirely.
 *
 * Feedback (actionable messages, BR "Content assignment" example):
 * benign rejections redirect back to the lesson editor with an
 * `error` URL flag the page renders inline — `locked` (published
 * course), `missing` (unknown lesson/content), `assigned` (content
 * already used), `invalid` (malformed input). Success redirects
 * plainly; the re-rendered assigned list is the success state.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Postgres unique-violation code (constraint is final authority). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export async function assignContentToLessonAction(
  courseId: string,
  lessonId: string,
  formData: FormData,
): Promise<void> {
  const editorHref = `/admin/courses/${courseId}/lessons/${lessonId}`;

  // 1. Authenticate — Supabase cookie session, validated server-side.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[lessons/assign-content] rejected: no session");
    redirect("/login");
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    console.error("[lessons/assign-content] rejected: not admin");
    redirect(editorHref);
  }

  // 3. Validate the minimal input contract.
  const contentId = formValue(formData, "contentId");

  if (!UUID_PATTERN.test(courseId) || !UUID_PATTERN.test(lessonId)) {
    console.error("[lessons/assign-content] rejected: malformed route ids");
    redirect(`${editorHref}?error=invalid`);
  }
  if (!contentId || !UUID_PATTERN.test(contentId)) {
    console.error("[lessons/assign-content] rejected: malformed contentId");
    redirect(`${editorHref}?error=invalid`);
  }

  // 4. Load/verify + execute — one transaction (see strategy above).
  try {
    await db.transaction(async (tx) => {
      // Lock the course row: serializes concurrent structural mutations
      // for this course and re-checks publish state under the lock
      // (Decisions #11).
      const [course] = await tx
        .select({ id: courses.id, status: courses.status })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (!course) {
        throw new AssignRejected("missing", "course not found");
      }
      if (course.status === "PUBLISHED") {
        throw new AssignRejected(
          "locked",
          "course is PUBLISHED (Decisions #11)",
        );
      }

      // Load + lock the lesson row; ownership is re-verified under the
      // lock (courseId match), never trusted from the payload.
      const [lesson] = await tx
        .select({ id: lessons.id, courseId: lessons.courseId })
        .from(lessons)
        .where(eq(lessons.id, lessonId))
        .for("update")
        .limit(1);

      if (!lesson || lesson.courseId !== courseId) {
        throw new AssignRejected("missing", "lesson not in course");
      }

      // Lock the lesson's assignment rows in sort_order order so the
      // MAX+1 append below is serialized against concurrent
      // assignments to the same lesson (UNIQUE(lesson_id, sort_order)
      // stays the final authority).
      const assignedRows = await tx
        .select({
          contentId: lessonContents.contentId,
          sortOrder: lessonContents.sortOrder,
        })
        .from(lessonContents)
        .where(eq(lessonContents.lessonId, lessonId))
        .orderBy(asc(lessonContents.sortOrder))
        .for("update");

      // The Content must exist (unknown ids die before any write).
      const [content] = await tx
        .select({ id: contents.id })
        .from(contents)
        .where(eq(contents.id, contentId))
        .limit(1);

      if (!content) {
        throw new AssignRejected("missing", "content not found");
      }

      // Availability (BR §25): a Content may sit in at most ONE lesson.
      // This read needs no lock — the UNIQUE(content_id) constraint is
      // the race-safe authority; a concurrent insert simply fails with
      // 23505 below and rolls back.
      const [inUse] = await tx
        .select({ lessonId: lessonContents.lessonId })
        .from(lessonContents)
        .where(eq(lessonContents.contentId, contentId))
        .limit(1);

      if (inUse) {
        throw new AssignRejected(
          "assigned",
          `content already assigned (lesson ${inUse.lessonId})`,
        );
      }

      // Append at the end of the persisted order (TASK 025 convention).
      const nextOrder =
        assignedRows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;

      await tx.insert(lessonContents).values({
        lessonId,
        contentId,
        sortOrder: nextOrder,
      });

      // Post-verify inside the transaction: exactly one row for this
      // (lesson, content) pair, at the computed append position, the
      // lesson's row count grew by exactly one, and the Content is
      // referenced by no other lesson.
      const lessonRows = await tx
        .select({
          contentId: lessonContents.contentId,
          sortOrder: lessonContents.sortOrder,
        })
        .from(lessonContents)
        .where(eq(lessonContents.lessonId, lessonId))
        .orderBy(asc(lessonContents.sortOrder));
      const matches = lessonRows.filter((row) => row.contentId === contentId);
      if (
        matches.length !== 1 ||
        matches[0].sortOrder !== nextOrder ||
        lessonRows.length !== assignedRows.length + 1
      ) {
        throw new Error(
          `[lessons/assign-content] post-verification failed: ${JSON.stringify(lessonRows.map((row) => row.sortOrder))}`,
        );
      }
      const usageRows = await tx
        .select({ lessonId: lessonContents.lessonId })
        .from(lessonContents)
        .where(eq(lessonContents.contentId, contentId));
      if (usageRows.length !== 1 || usageRows[0].lessonId !== lessonId) {
        throw new Error(
          "[lessons/assign-content] post-verification failed: reuse",
        );
      }
    });
  } catch (error) {
    if (error instanceof AssignRejected) {
      // Benign rejection — CMS §45 logs the reason; the redirect flag
      // gives the admin an actionable message (BR example wording).
      console.error(
        `[lessons/assign-content] rejected: ${error.detail}`,
      );
      redirect(`${editorHref}?error=${error.flag}`);
    }
    if (isUniqueViolation(error)) {
      // Lost a race against the constraint (CMS §11: reject
      // gracefully). The transaction already rolled back.
      console.error("[lessons/assign-content] unique violation (race)");
      redirect(`${editorHref}?error=assigned`);
    }
    console.error("[lessons/assign-content] transaction failed:", error);
    redirect(`${editorHref}?error=invalid`);
  }

  // 5. Success — back to the lesson editor, whose re-rendered assigned
  //    list is the success state. redirect() throws, so nothing
  //    returns.
  redirect(editorHref);
}

/** Control-flow marker for rejected (non-error) assignments. */
class AssignRejected extends Error {
  /** URL flag the editor renders as an actionable message. */
  readonly flag: "locked" | "missing" | "assigned";
  readonly detail: string;

  constructor(flag: "locked" | "missing" | "assigned", detail: string) {
    super(detail);
    this.name = "AssignRejected";
    this.flag = flag;
    this.detail = detail;
  }
}
