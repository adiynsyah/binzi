"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { contents, courses, lessonContents, lessons } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { getLessonQuizPublishChecks } from "@/features/quizzes/services/quiz.service";
import type { PublishCheck, PublishState } from "../schemas/publish.schema";

/**
 * BINZI Lesson Publish server action (TASK 035, CMS §19 "Lesson
 * Publish Validation" + §30 "Publish Workflow", BR §22/§23/§32).
 *
 * Publishing is an explicit, server-authoritative operation that
 * validates the PERSISTED database state — never the admin's unsaved
 * editor state and never client-submitted fields (BR §32: the UI
 * checklist is guidance; this action is the authority). The action
 * takes NO form fields at all: the course and lesson ids are bound
 * server-side by the lesson editor page via .bind, and the unused
 * useActionState arguments are simply not declared.
 *
 * Checklist (CMS §19, each mapped to a spec, nothing invented):
 * 1. Lesson metadata valid → persisted title non-empty (NOT NULL
 *    column; only whitespace can fail it).
 * 2. At least one Content item exists → lesson_contents count.
 * 3. All assigned Content items are published → V1 publishing model
 *    ("usable" = status PUBLISHED; V1 has no unpublish/delete paths
 *    that could invalidate this after the fact).
 * 4.–7. Exactly one Lesson Quiz with exactly 10 Questions, every
 *    Question with valid options and exactly one correct option →
 *    the centralized quiz.service.ts validators (TASK 035 goal).
 *
 * Atomicity / locking, mirroring the TASK 025–034 mutation pattern:
 * course row FOR UPDATE first (a PUBLISHED course means the lesson
 * structure is locked — Decisions Log #11), then the lesson row by
 * (course_id, id) FOR UPDATE (ownership inside the match — a
 * cross-course lesson id matches no row and is reported as missing,
 * IDOR-safe). All structure mutations lock the course row first, so
 * the validation reads that follow the lock see a stable committed
 * state. The final transition is one guarded UPDATE
 * (`status = 'DRAFT'`) setting status + published_at together — a
 * concurrent publish can never double-apply, and the DB CHECK
 * lessons_published_at_check holds by construction. Any failure
 * returns BEFORE the UPDATE: zero database writes on rejection.
 *
 * An already-PUBLISHED lesson is rejected without changes —
 * republishing is not defined in V1 and no timestamp-overwrite
 * semantic is invented (same contract as TASK 020 content publish).
 * Unpublishing is likewise not part of V1 tasks.
 */
export async function publishLessonAction(
  courseId: string,
  lessonId: string,
): Promise<PublishState> {
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
      message: "Anda tidak memiliki izin untuk menerbitkan pelajaran.",
    };
  }

  // 3. Validate ids — malformed UUIDs can never match a row.
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_PATTERN.test(courseId) || !UUID_PATTERN.test(lessonId)) {
    return {
      status: "error",
      message: "Pelajaran tidak ditemukan atau sudah dihapus.",
    };
  }

  // 4. Load, lock, and validate — one transaction, zero writes on
  //    any rejection.
  try {
    await db.transaction(async (tx) => {
      // 4a. Lock the course first (established lock order). A
      //     PUBLISHED course locks its lesson structure (Decisions
      //     Log #11) — the lesson cannot be published from under it.
      const courseRows = await tx
        .select({ status: courses.status })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (courseRows.length === 0) {
        throw new LessonPublishReject(
          "Pelajaran tidak ditemukan atau sudah dihapus.",
        );
      }
      if (courseRows[0].status === "PUBLISHED") {
        throw new LessonPublishReject(
          "Kursus sudah diterbitkan — struktur pelajaran terkunci.",
        );
      }

      // 4b. Lock the lesson; ownership is part of the match itself.
      const lessonRows = await tx
        .select({ id: lessons.id, title: lessons.title, status: lessons.status })
        .from(lessons)
        .where(and(eq(lessons.courseId, courseId), eq(lessons.id, lessonId)))
        .for("update")
        .limit(1);

      if (lessonRows.length === 0) {
        throw new LessonPublishReject(
          "Pelajaran tidak ditemukan atau sudah dihapus.",
        );
      }
      if (lessonRows[0].status === "PUBLISHED") {
        throw new LessonPublishReject("Pelajaran sudah diterbitkan.");
      }

      // 4c. CMS §19.2–3: assigned Content (count + publish state)
      //     straight from the persisted join.
      const contentRows = await tx
        .select({
          total: sql<number>`count(*)::int`,
          drafts: sql<number>`count(*) filter (where ${contents.status} = 'DRAFT')::int`,
        })
        .from(lessonContents)
        .innerJoin(contents, eq(contents.id, lessonContents.contentId))
        .where(eq(lessonContents.lessonId, lessonId));

      const total = contentRows[0]?.total ?? 0;
      const drafts = contentRows[0]?.drafts ?? 0;

      // 4d. CMS §19.4–7 via the centralized quiz service (reads run
      //     after the locks; see the service header for ordering).
      const quizChecks = await getLessonQuizPublishChecks(lessonId);

      // 4e. Compose the full actionable checklist (CMS §19.1 first).
      const composed: PublishCheck[] = [
        {
          id: "metadata",
          state: lessonRows[0].title.trim().length > 0 ? "pass" : "fail",
          label:
            lessonRows[0].title.trim().length > 0
              ? "Informasi pelajaran lengkap."
              : "Judul pelajaran wajib diisi.",
        },
        {
          id: "content-count",
          state: total > 0 ? "pass" : "fail",
          label:
            total > 0
              ? `${total} konten ditugaskan.`
              : "Belum ada konten yang ditugaskan.",
        },
        {
          id: "content-published",
          state: drafts === 0 ? "pass" : "fail",
          label:
            drafts === 0
              ? "Semua konten sudah diterbitkan."
              : `${drafts} konten masih berupa draf.`,
        },
        ...quizChecks,
      ];

      if (composed.some((check) => check.state === "fail")) {
        throw new LessonPublishReject(
          "Pelajaran belum memenuhi syarat penerbitan.",
          composed,
        );
      }

      // 5. Atomic publish: one guarded UPDATE, status + published_at
      //    together (lessons_published_at_check by construction).
      const updated = await tx
        .update(lessons)
        .set({ status: "PUBLISHED", publishedAt: new Date() })
        .where(and(eq(lessons.id, lessonId), eq(lessons.status, "DRAFT")))
        .returning({ id: lessons.id });

      if (updated.length === 0) {
        // Not a DRAFT anymore — a concurrent publish won the race.
        throw new LessonPublishReject("Pelajaran sudah diterbitkan.");
      }

      // Post-verification inside the transaction (established
      // pattern): exactly one row, PUBLISHED, timestamp present.
      const verify = await tx
        .select({ status: lessons.status, publishedAt: lessons.publishedAt })
        .from(lessons)
        .where(eq(lessons.id, lessonId))
        .limit(1);
      if (
        verify.length !== 1 ||
        verify[0].status !== "PUBLISHED" ||
        verify[0].publishedAt === null
      ) {
        throw new Error("lesson publish post-verification failed");
      }

      return composed;
    });
  } catch (error) {
    if (error instanceof LessonPublishReject) {
      return { status: "error", message: error.message, checks: error.checks };
    }
    console.error("[courses/publish-lesson] failed:", error);
    return {
      status: "error",
      message: "Gagal menerbitkan pelajaran. Silakan coba lagi.",
    };
  }

  // 6. Success — back to the lesson editor, which now shows the
  //    published state (badge) and no longer renders the form.
  redirect(`/admin/courses/${courseId}/lessons/${lessonId}`);
}

/** Internal control-flow exception — always mapped to a state. */
class LessonPublishReject extends Error {
  checks?: PublishCheck[];

  constructor(message: string, checks?: PublishCheck[]) {
    super(message);
    this.checks = checks;
  }
}
