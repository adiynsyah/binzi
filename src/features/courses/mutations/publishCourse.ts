"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { contents, courses, lessonContents, lessons } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  getCourseLessonQuizPublishChecks,
  getFinalQuizPublishChecks,
} from "@/features/quizzes/services/quiz.service";
import type { PublishCheck, PublishState } from "../schemas/publish.schema";

/**
 * BINZI Course Publish server action (TASK 035, CMS §29 "Course
 * Publish Validation" + §30, BR §2.3/§22/§23/§32; structure locking
 * per Decisions Log #11).
 *
 * The authoritative course publication checklist, every item mapped
 * to a spec (nothing invented):
 * 1. Course metadata valid → persisted title non-empty (BR §2.3).
 * 2. At least one Lesson exists (BR §2.3, CMS §29.2).
 * 3. Every Lesson is PUBLISHED — the V1 rule "All Lessons included
 *    in a published Course must be Published" (CMS §29).
 * 4.–5. Every Lesson has exactly one Lesson Quiz with exactly 10
 *    Questions → centralized quiz.service.ts (CMS §29.4–5).
 * 6.–7. Final Quiz exists with 10–30 Questions → quiz.service.ts
 *    (CMS §29.6–7, BR §16).
 * 8. Required referenced content is published/valid → re-checked
 *    against the persisted lesson_contents join even though lesson
 *    publication already validated it (belt and braces; V1 has no
 *    content unpublish/delete path that could invalidate it later).
 *
 * Per-question option/correctness validity is enforced inside the
 * quiz service checks for BOTH quiz kinds (BR §14/§15, CMS §19.6–7).
 *
 * Atomicity / locking: the course row is locked FOR UPDATE first and
 * its status rechecked under the lock (Decisions #11 TOCTOU guard —
 * identical to the TASK 025–034 mutation pattern). Every structure
 * mutation locks the same row first, so the validation reads that
 * follow the lock see a stable committed state, and any builder that
 * was waiting rechecks the course status AFTER this commit and
 * rejects as locked. The transition itself is one guarded UPDATE
 * (`status = 'DRAFT'`) setting status + published_at together
 * (courses_published_at_check by construction), followed by an
 * in-transaction post-verification. Every rejection returns BEFORE
 * the UPDATE — zero database writes on failure (BR §23).
 *
 * An already-PUBLISHED course is rejected without changes; V1 defines
 * no republish or unpublish semantics here (unpublish has no task in
 * the plan). The action takes NO form fields — the course id is
 * bound server-side by the Course Builder page via .bind.
 */
export async function publishCourseAction(
  courseId: string,
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
      message: "Anda tidak memiliki izin untuk menerbitkan kursus.",
    };
  }

  // 3. Validate the id — malformed UUIDs can never match a row.
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_PATTERN.test(courseId)) {
    return {
      status: "error",
      message: "Kursus tidak ditemukan atau sudah dihapus.",
    };
  }

  // 4. Load, lock, and validate — one transaction, zero writes on
  //    any rejection.
  try {
    await db.transaction(async (tx) => {
      // 4a. Lock the course row (established lock order) and
      //     recheck its status under the lock.
      const courseRows = await tx
        .select({ title: courses.title, status: courses.status })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (courseRows.length === 0) {
        throw new CoursePublishReject(
          "Kursus tidak ditemukan atau sudah dihapus.",
        );
      }
      if (courseRows[0].status === "PUBLISHED") {
        throw new CoursePublishReject("Kursus sudah diterbitkan.");
      }

      // 4b. Course lessons in persisted order (CMS §29.2–3).
      const lessonRows = await tx
        .select({ id: lessons.id, status: lessons.status })
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
        .orderBy(asc(lessons.sortOrder));

      const draftLessons = lessonRows.filter(
        (lesson) => lesson.status === "DRAFT",
      ).length;

      // 4c. CMS §29.8: referenced content still published (persisted
      //     join across every lesson of the course).
      const contentRows = await tx
        .select({
          drafts: sql<number>`count(*) filter (where ${contents.status} = 'DRAFT')::int`,
        })
        .from(lessonContents)
        .innerJoin(lessons, eq(lessons.id, lessonContents.lessonId))
        .innerJoin(contents, eq(contents.id, lessonContents.contentId))
        .where(eq(lessons.courseId, courseId));

      const draftContents = contentRows[0]?.drafts ?? 0;

      // 4d. Centralized quiz publication rules (TASK 035 goal):
      //     every Lesson Quiz + the Final Quiz. Reads run after the
      //     course lock — see the quiz.service.ts header.
      const lessonQuizChecks = await getCourseLessonQuizPublishChecks(
        courseId,
      );
      const finalQuizChecks = await getFinalQuizPublishChecks(courseId);

      // 4e. Compose the full actionable checklist.
      const composed: PublishCheck[] = [
        {
          id: "metadata",
          state: courseRows[0].title.trim().length > 0 ? "pass" : "fail",
          label:
            courseRows[0].title.trim().length > 0
              ? "Informasi kursus lengkap."
              : "Judul kursus wajib diisi.",
        },
        {
          id: "lesson-count",
          state: lessonRows.length > 0 ? "pass" : "fail",
          label:
            lessonRows.length > 0
              ? `${lessonRows.length} pelajaran tersedia.`
              : "Belum ada pelajaran — minimal satu wajib.",
        },
        {
          id: "lessons-published",
          state: draftLessons === 0 ? "pass" : "fail",
          label:
            draftLessons === 0
              ? "Semua pelajaran sudah diterbitkan."
              : `${draftLessons} pelajaran masih berupa draf — terbitkan pelajaran terlebih dahulu.`,
        },
        {
          id: "content-published",
          state: draftContents === 0 ? "pass" : "fail",
          label:
            draftContents === 0
              ? "Semua konten referensi sudah diterbitkan."
              : `${draftContents} konten referensi masih berupa draf.`,
        },
        ...lessonQuizChecks,
        ...finalQuizChecks,
      ];

      if (composed.some((check) => check.state === "fail")) {
        throw new CoursePublishReject(
          "Kursus belum memenuhi syarat penerbitan.",
          composed,
        );
      }

      // 5. Atomic publish: one guarded UPDATE, status + published_at
      //    together (courses_published_at_check by construction).
      const updated = await tx
        .update(courses)
        .set({ status: "PUBLISHED", publishedAt: new Date() })
        .where(and(eq(courses.id, courseId), eq(courses.status, "DRAFT")))
        .returning({ id: courses.id });

      if (updated.length === 0) {
        // Not a DRAFT anymore — a concurrent publish won the race.
        throw new CoursePublishReject("Kursus sudah diterbitkan.");
      }

      // Post-verification inside the transaction (established
      // pattern): exactly one row, PUBLISHED, timestamp present.
      const verify = await tx
        .select({ status: courses.status, publishedAt: courses.publishedAt })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      if (
        verify.length !== 1 ||
        verify[0].status !== "PUBLISHED" ||
        verify[0].publishedAt === null
      ) {
        throw new Error("course publish post-verification failed");
      }
    });
  } catch (error) {
    if (error instanceof CoursePublishReject) {
      return { status: "error", message: error.message, checks: error.checks };
    }
    console.error("[courses/publish-course] failed:", error);
    return {
      status: "error",
      message: "Gagal menerbitkan kursus. Silakan coba lagi.",
    };
  }

  // 6. Success — back to the Course Builder, which now shows the
  //    published state (badge, locked panels) and no publish form.
  redirect(`/admin/courses/${courseId}/edit`);
}

/** Internal control-flow exception — always mapped to a state. */
class CoursePublishReject extends Error {
  checks?: PublishCheck[];

  constructor(message: string, checks?: PublishCheck[]) {
    super(message);
    this.checks = checks;
  }
}
