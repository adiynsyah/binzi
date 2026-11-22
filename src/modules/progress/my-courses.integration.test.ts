// Integration tests for Kursus Saya + the course progress page (card S5-04
// §1) over PGlite — same harness as lesson-page.integration.test.ts. A FRESH
// member per test so enrollment sets never bleed between tests.
//
// Covers the card's integration "Selesai jika":
// - getMyCoursesPage: empty → available CONTAINS the test course (not the
//   exact list); filled → available = [] exactly.
// - Ordering: enrollments.updated_at desc (written explicitly, raw
//   ISO + ::timestamptz, as the LAST write before reading — the services
//   re-stamp via $onUpdate), courses.id asc as the tie-break — with course
//   ids written explicitly so id-asc, insertion order, and the expected
//   order are three DIFFERENT orders.
// - The PUBLISHED + has-lessons filter: DRAFT/ARCHIVED courses that STILL
//   HAVE lessons and newer stamps never appear (mutation 3 data).
// - A stale last_lesson_id pointing at ANOTHER course's lesson answers
//   lastLessonTitle null AND falls back to Materi 1 for continueHref.
// - getCourseProgressPage read order: unknown slug → 404; DRAFT → 404;
//   PUBLISHED without lessons → 404 (enrolled AND not enrolled); not
//   enrolled → kembali to the public course detail (card S6-02 keputusan
//   11).
// - The five lesson statuses in one read (non-sequential + sequential
//   course), the row-3 sedang-dipelajari video DTO, and the ringkasan
//   numbers (raw-score average 85 over 2 graded of 4 — mutation 20).
// - Final Quiz row: terkunci → terbuka (all COMPLETED) → selesai (stored
//   PASSED + finalScorePercent rounded 67.50 → 68, badge lulus).
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  courses,
  enrollments,
  lessonProgress,
  lessons,
  users,
} from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { SessionUser } from "@/lib/rbac";
import { createCourse } from "@/modules/course/service";
import { createLesson } from "@/modules/lesson/service";

// Same "@/db" Proxy swap as service.integration.test.ts (queries.ts pulls
// the singleton; the tests point it at PGlite).
const dbHolder = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        const target = dbHolder.current as
          | Record<string | symbol, unknown>
          | undefined;
        if (!target) {
          throw new Error(
            "@/db mock used before the PGlite instance was installed",
          );
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    },
  ),
}));

import {
  enrollInCourse,
  getCourseProgressPage,
  getMyCoursesPage,
  lessonHref,
} from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

const EDITOR = {
  id: "u-editor",
  role: "EDITOR" as const,
  status: "ACTIVE" as const,
};

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/migrations", import.meta.url),
    ),
  });
  db = pgliteDb as unknown as Db;
  dbHolder.current = pgliteDb;

  await db.insert(users).values({
    id: EDITOR.id,
    name: "Editor Satu",
    email: "editor@example.com",
    emailVerified: true,
    role: "EDITOR",
  });
});

afterAll(async () => {
  await pglite.close();
});

// --- data builders -------------------------------------------------------

let counter = 0;
function nextPair(prefix: string): { title: string; slug: string } {
  counter += 1;
  return {
    title: `${prefix} kursu ${counter}`,
    slug: `${prefix}-kursu-${counter}`,
  };
}

/** A fresh MEMBER actor with its own user row (per-test isolation). */
async function newMember(label: string): Promise<SessionUser> {
  counter += 1;
  const id = `u-member-${label}-${counter}`;
  await db.insert(users).values({
    id,
    name: `Member ${label} ${counter}`,
    email: `member-${label}-${counter}@example.com`,
    emailVerified: true,
    role: "MEMBER",
  });
  return { id, role: "MEMBER", status: "ACTIVE" };
}

/** PUBLISHED course with titled lessons (slugs come back from the service). */
async function makeCourse(
  prefix: string,
  options: {
    lessonTitles?: string[];
    status?: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
    isSequential?: boolean;
  } = {},
) {
  const { title, slug } = nextPair(prefix);
  const course = await createCourse(EDITOR, {
    title,
    slug,
    level: "BEGINNER",
    summary: "Ringkasan netral untuk tes.",
  });
  const lessonRows = [];
  for (const lessonTitle of options.lessonTitles ?? []) {
    lessonRows.push(
      await createLesson(EDITOR, course.id, { title: lessonTitle }),
    );
  }
  await db
    .update(courses)
    .set({
      status: options.status ?? "PUBLISHED",
      ...(options.isSequential !== undefined
        ? { isSequential: options.isSequential }
        : {}),
    })
    .where(eq(courses.id, course.id));
  return { course, lessons: lessonRows, slug };
}

async function enrollmentOf(userId: string, courseId: string) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(
      sql`${enrollments.userId} = ${userId} and ${enrollments.courseId} = ${courseId}`,
    );
  return row;
}

/** Upsert THIS participant's lesson_progress row (the quiz card's write). */
async function setLessonProgress(
  userId: string,
  lessonId: string,
  enrollmentId: string,
  values: Partial<typeof lessonProgress.$inferInsert>,
) {
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, enrollmentId, ...values })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: values,
    });
}

/** A READY YouTube video on the lesson (the S2-02 demo source). */
async function attachYouTubeVideo(
  lessonId: string,
  durationSeconds: number,
) {
  await db
    .update(lessons)
    .set({
      videoStatus: "READY",
      videoProvider: "YOUTUBE",
      videoExternalId: "dQw4w9WgXcQ",
      videoDurationSeconds: durationSeconds,
    })
    .where(eq(lessons.id, lessonId));
}

/**
 * The explicit activity stamp — RAW SQL (an update() would re-stamp through
 * $onUpdate too, but raw ISO + ::timestamptz is the write the card asks for)
 * — always the LAST write before the page is read, because openLesson /
 * recordVideoProgress / the Final submit all re-stamp updated_at.
 */
async function stampEnrollmentUpdatedAt(
  userId: string,
  courseId: string,
  iso: string,
) {
  await db.execute(
    sql`update enrollments set updated_at = ${iso}::timestamptz
        where user_id = ${userId} and course_id = ${courseId}`,
  );
}

const daysAgoIso = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

// --- getMyCoursesPage ----------------------------------------------------

describe("getMyCoursesPage", () => {
  it("no enrollment: courses [] and the test course IS in available (presence, not the exact list)", async () => {
    const member = await newMember("empty");
    const made = await makeCourse("tersedia", {
      lessonTitles: ["Materi satu"],
    });
    // Mutation 3's data: DRAFT/ARCHIVED courses WITH lessons — only the
    // status filter keeps them out of the catalog list.
    const draft = await makeCourse("draf", {
      lessonTitles: ["Materi satu"],
      status: "DRAFT",
    });
    const archived = await makeCourse("arsip", {
      lessonTitles: ["Materi satu"],
      status: "ARCHIVED",
    });

    const page = await getMyCoursesPage(member);
    expect(page.courses).toEqual([]);
    expect(
      page.available.some((course) => course.slug === made.slug),
    ).toBe(true);
    expect(
      page.available.some((course) => course.slug === draft.slug),
    ).toBe(false);
    expect(
      page.available.some((course) => course.slug === archived.slug),
    ).toBe(false);
  });

  it("enrolled: available is exactly [] and the course renders the belum-dimulai shape", async () => {
    const member = await newMember("isi");
    const made = await makeCourse("diikuti", {
      lessonTitles: ["Materi satu", "Materi dua", "Materi tiga"],
    });
    await enrollInCourse(member, made.course.id);

    const page = await getMyCoursesPage(member);
    expect(page.available).toEqual([]);
    expect(page.courses).toHaveLength(1);
    const dto = page.courses[0]!;
    expect(dto.slug).toBe(made.slug);
    expect(dto.badge).toBe("belum-dimulai");
    expect(dto.meta.kind).toBe("diikuti");
    expect(dto.lessonCount).toBe(3);
    expect(dto.completedLessonCount).toBe(0);
    expect(dto.continueHref).toBe(
      lessonHref(made.slug, made.lessons[0]!.slug),
    );
    expect(dto.progressHref).toBe(`/belajar/${made.slug}`);
  });

  it("ordered by enrollments.updated_at desc — explicit stamps as the LAST write; id asc never rescues the order; three badges; another participant's enrollments never leak", async () => {
    const member = await newMember("urut");
    // Explicit ids: id-asc order (A, B, C) differs from the expected
    // updated_at-desc order (C, A, B), and the enrollment INSERT order is a
    // third order (B, C, A) — only the real ORDER BY produces the result.
    const specs = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "urut-kursu-a",
        title: "Urut kursu A",
        daysAgo: 2,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        slug: "urut-kursu-b",
        title: "Urut kursu B",
        daysAgo: 3,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        slug: "urut-kursu-c",
        title: "Urut kursu C",
        daysAgo: 1,
      },
    ];
    const lessonIds = new Map<string, string>();
    for (const spec of specs) {
      await db.insert(courses).values({
        id: spec.id,
        title: spec.title,
        slug: spec.slug,
        level: "BEGINNER",
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdBy: EDITOR.id,
        updatedBy: EDITOR.id,
      });
      const [lesson] = await db
        .insert(lessons)
        .values({
          courseId: spec.id,
          title: "Materi satu",
          slug: "materi-1",
          orderIndex: 1,
          content: { type: "doc", content: [] },
        })
        .returning({ id: lessons.id });
      lessonIds.set(spec.slug, lesson!.id);
    }
    // Insert order B, C, A — deliberately NOT the expected order.
    for (const slug of ["urut-kursu-b", "urut-kursu-c", "urut-kursu-a"]) {
      const spec = specs.find((entry) => entry.slug === slug)!;
      await db.insert(enrollments).values({
        userId: member.id,
        courseId: spec.id,
      });
    }
    // The three badges (card §3): C stored PASSED → lulus, A one COMPLETED
    // lesson → sedang-berjalan, B untouched → belum-dimulai.
    await db
      .update(enrollments)
      .set({ status: "PASSED", finalScorePercent: "90.00" })
      .where(
        sql`${enrollments.userId} = ${member.id} and ${enrollments.courseId} = ${specs[2]!.id}`,
      );
    await setLessonProgress(member.id, lessonIds.get("urut-kursu-a")!, (
      await enrollmentOf(member.id, specs[0]!.id)
    )!.id, {
      status: "COMPLETED",
      completedAt: new Date(),
    });
    // Participant B: a FOURTH PUBLISHED course with lessons of their own,
    // plus a second enrollment in the actor's course A — both stamped NEWER
    // than everything the actor ever did. Without enrollments.user_id in the
    // query this test fails ALONE (B's rows would flood the actor's list).
    const other = await newMember("urut-lain");
    const otherCourse = await makeCourse("urut-lain", { lessonTitles: ["Materi satu"] });
    await db.insert(enrollments).values({
      userId: other.id,
      courseId: otherCourse.course.id,
    });
    await db.insert(enrollments).values({
      userId: other.id,
      courseId: specs[0]!.id,
    });
    await stampEnrollmentUpdatedAt(other.id, otherCourse.course.id, daysAgoIso(0));
    await stampEnrollmentUpdatedAt(other.id, specs[0]!.id, daysAgoIso(0));
    // The actor's stamps are the LAST write about the ACTOR before the read.
    for (const spec of specs) {
      await stampEnrollmentUpdatedAt(
        member.id,
        spec.id,
        daysAgoIso(spec.daysAgo),
      );
    }

    const page = await getMyCoursesPage(member);
    expect(page.courses.map((course) => course.slug)).toEqual([
      "urut-kursu-c",
      "urut-kursu-a",
      "urut-kursu-b",
    ]);
    expect(page.courses.map((course) => course.badge)).toEqual([
      "lulus",
      "sedang-berjalan",
      "belum-dimulai",
    ]);
  });

  it("DRAFT/ARCHIVED courses WITH lessons and a NEWER stamp never appear (only the status filter keeps them out)", async () => {
    const member = await newMember("status");
    const draft = await makeCourse("draf", {
      lessonTitles: ["Materi satu"],
      status: "DRAFT",
    });
    const archived = await makeCourse("arsip", {
      lessonTitles: ["Materi satu"],
      status: "ARCHIVED",
    });
    const published = await makeCourse("aktif", {
      lessonTitles: ["Materi satu"],
    });
    for (const made of [draft, archived, published]) {
      // Direct rows: the service refuses to enroll in unpublished courses.
      await db.insert(enrollments).values({
        userId: member.id,
        courseId: made.course.id,
      });
    }
    // Unpublished stamps are the NEWEST — the filter, not recency, excludes.
    await stampEnrollmentUpdatedAt(member.id, draft.course.id, daysAgoIso(0));
    await stampEnrollmentUpdatedAt(
      member.id,
      archived.course.id,
      daysAgoIso(0),
    );
    await stampEnrollmentUpdatedAt(
      member.id,
      published.course.id,
      daysAgoIso(5),
    );

    const page = await getMyCoursesPage(member);
    expect(page.courses.map((course) => course.slug)).toEqual([
      published.slug,
    ]);
  });

  it("a stale last_lesson_id pointing at ANOTHER course's lesson: title null, continueHref falls back to Materi 1", async () => {
    const member = await newMember("stal");
    const mine = await makeCourse("milik", {
      lessonTitles: ["Materi satu", "Materi dua"],
    });
    const other = await makeCourse("lain", {
      lessonTitles: ["Materi asing"],
    });
    await enrollInCourse(member, mine.course.id);
    // last_lesson_id satisfies the FK but belongs to another course — the
    // course_id-bounded subqueries must answer null for slug AND title.
    await db
      .update(enrollments)
      .set({ lastLessonId: other.lessons[0]!.id })
      .where(eq(enrollments.id, (await enrollmentOf(member.id, mine.course.id))!.id));

    const page = await getMyCoursesPage(member);
    expect(page.courses).toHaveLength(1);
    const dto = page.courses[0]!;
    expect(dto.badge).toBe("sedang-berjalan");
    expect(dto.lastLessonTitle).toBeNull();
    expect(dto.continueHref).toBe(
      lessonHref(mine.slug, mine.lessons[0]!.slug),
    );
  });
});

// --- getCourseProgressPage ----------------------------------------------

describe("getCourseProgressPage — 404s and kembali", () => {
  it("unknown slug → NotFoundError", async () => {
    const member = await newMember("404a");
    await expect(
      getCourseProgressPage(member, "kursus-tak-ada"),
    ).rejects.toThrow(NotFoundError);
  });

  it("DRAFT course → the same NotFoundError (its existence never leaks)", async () => {
    const member = await newMember("404b");
    const made = await makeCourse("draf2", {
      lessonTitles: ["Materi satu"],
      status: "DRAFT",
    });
    await db.insert(enrollments).values({
      userId: member.id,
      courseId: made.course.id,
    });
    await expect(
      getCourseProgressPage(member, made.slug),
    ).rejects.toThrow(NotFoundError);
  });

  it("PUBLISHED course without lessons → NotFoundError, enrolled or not", async () => {
    const enrolled = await newMember("404c");
    const notEnrolled = await newMember("404d");
    const made = await makeCourse("kosong"); // PUBLISHED, zero lessons
    await db.insert(enrollments).values({
      userId: enrolled.id,
      courseId: made.course.id,
    });
    await expect(
      getCourseProgressPage(enrolled, made.slug),
    ).rejects.toThrow(NotFoundError);
    await expect(
      getCourseProgressPage(notEnrolled, made.slug),
    ).rejects.toThrow(NotFoundError);
  });

  it("not enrolled → kembali to the public course detail (card S6-02 keputusan 11)", async () => {
    const member = await newMember("kembali");
    const made = await makeCourse("belum-ikut", {
      lessonTitles: ["Materi satu", "Materi dua"],
    });

    const page = await getCourseProgressPage(member, made.slug);
    expect(page).toEqual({
      state: "kembali",
      href: `/kursus/${made.slug}`,
    });
  });
});

describe("getCourseProgressPage — statuses, video, ringkasan, final", () => {
  it("the five statuses + the row-3 video DTO + the raw-score ringkasan (two graded of four → 85)", async () => {
    const member = await newMember("lima");
    const open = await makeCourse("lima-terbuka", {
      lessonTitles: ["Materi satu", "Materi dua", "Materi tiga", "Materi empat"],
      isSequential: false,
    });
    await enrollInCourse(member, open.course.id);
    const enrollment = (await enrollmentOf(member.id, open.course.id))!;
    const [l1, l2, l3] = open.lessons;

    // 1: COMPLETED + attempted + passed 90 → selesai.
    await setLessonProgress(member.id, l1!.id, enrollment.id, {
      status: "COMPLETED",
      quizAttempted: true,
      quizScorePercent: "90.00",
      quizIsPassed: true,
      quizSubmittedAt: new Date(),
      completedAt: new Date(),
    });
    // 2: attempted but the READY video sits at 40 % → sedang-dipelajari (row
    //    3), WITH the video DTO on that branch.
    await attachYouTubeVideo(l2!.id, 100);
    await setLessonProgress(member.id, l2!.id, enrollment.id, {
      status: "IN_PROGRESS",
      quizAttempted: true,
      quizScorePercent: "80.00",
      quizIsPassed: false,
      quizSubmittedAt: new Date(),
      videoWatchedPercent: "40.00",
      videoLastPositionSeconds: 40,
    });
    // 3: opened, no video requirement → quiz-belum.
    await setLessonProgress(member.id, l3!.id, enrollment.id, {
      status: "IN_PROGRESS",
    });
    // 4: untouched → belum-mulai.

    const page = await getCourseProgressPage(member, open.slug);
    expect(page.state).toBe("progres");
    if (page.state !== "progres") return;
    expect(page.lessons.map((lesson) => lesson.status)).toEqual([
      "selesai",
      "sedang-dipelajari",
      "quiz-belum",
      "belum-mulai",
    ]);
    expect(page.lessons[1]!.video).toEqual({
      positionSeconds: 40,
      durationSeconds: 100,
    });
    // Raw-score average: (90 + 80) / 2 — the two ungraded rows stay out.
    expect(page.lessonAveragePercent).toBe(85);
    expect(page.gradedLessonCount).toBe(2);
    expect(page.hasFailedLesson).toBe(true);
    expect(page.finalScorePercent).toBeNull();
    expect(page.lessonCount).toBe(4);
    expect(page.completedLessonCount).toBe(1);
    // The auto-created FINAL quiz: unfilled (0 questions) and still locked.
    expect(page.final).toMatchObject({
      status: "terkunci",
      questionCount: 0,
      durationMinutes: 20,
    });

    // terkunci needs the sequential gate: successor of an unattempted
    // lesson. Same participant, second course.
    const gated = await makeCourse("lima-gerbang", {
      lessonTitles: ["Materi satu", "Materi dua"],
      isSequential: true,
    });
    await enrollInCourse(member, gated.course.id);
    const gatedPage = await getCourseProgressPage(member, gated.slug);
    expect(gatedPage.state).toBe("progres");
    if (gatedPage.state !== "progres") return;
    expect(gatedPage.lessons.map((lesson) => lesson.status)).toEqual([
      "belum-mulai",
      "terkunci",
    ]);
    expect(gatedPage.lessons[1]!.href).toBeNull();
  });

  it("final row: terbuka when every lesson is COMPLETED, selesai once the stored status leaves IN_PROGRESS (67.50 → 68, badge lulus)", async () => {
    const member = await newMember("final");
    const made = await makeCourse("final-kursu", {
      lessonTitles: ["Materi satu", "Materi dua"],
      isSequential: false,
    });
    await enrollInCourse(member, made.course.id);
    const enrollment = (await enrollmentOf(member.id, made.course.id))!;
    for (const lesson of made.lessons) {
      await setLessonProgress(member.id, lesson.id, enrollment.id, {
        status: "COMPLETED",
        quizAttempted: true,
        quizScorePercent: "90.00",
        quizIsPassed: true,
        quizSubmittedAt: new Date(),
        completedAt: new Date(),
      });
    }
    // Two real questions in the FINAL quiz — the count subquery's outer
    // reference is the drizzle bare-name pitfall's exact spot (mutation 13).
    await db.insert(schema.questions).values(
      [1, 2].map((order) => ({
        quizId: made.course.finalQuiz!.id,
        orderIndex: order,
        text: sql`'{"type":"doc"}'::jsonb`,
      })),
    );

    const open = await getCourseProgressPage(member, made.slug);
    expect(open.state).toBe("progres");
    if (open.state !== "progres") return;
    expect(open.final!.status).toBe("terbuka");
    expect(open.final!.href).toBe(`/belajar/${made.slug}/final-quiz`);
    expect(open.final!.questionCount).toBe(2);
    expect(open.badge).toBe("sedang-berjalan");

    // The stored verdict (never recomputed): PASSED + 67.50.
    await db
      .update(enrollments)
      .set({ status: "PASSED", finalScorePercent: "67.50" })
      .where(eq(enrollments.id, enrollment.id));
    const done = await getCourseProgressPage(member, made.slug);
    expect(done.state).toBe("progres");
    if (done.state !== "progres") return;
    expect(done.final!.status).toBe("selesai");
    expect(done.finalScorePercent).toBe(68);
    expect(done.badge).toBe("lulus");
  });

  it("another participant's progress never leaks into the actor's DTO (mutation 1: user_id in the outline JOIN)", async () => {
    const member = await newMember("isolat");
    const other = await newMember("isolat-b");
    const made = await makeCourse("isolat-kursu", {
      lessonTitles: ["Materi satu", "Materi dua", "Materi tiga"],
    });
    await enrollInCourse(member, made.course.id);
    await enrollInCourse(other, made.course.id);
    // The actor opens ONLY lesson 1.
    const memberEnrollment = (await enrollmentOf(member.id, made.course.id))!;
    await setLessonProgress(
      member.id,
      made.lessons[0]!.id,
      memberEnrollment.id,
      { status: "IN_PROGRESS" },
    );
    const before = await getCourseProgressPage(member, made.slug);

    // B completes lesson 2 — a lesson the actor never opened — with a quiz
    // score. Every column B writes must stay invisible in the actor's DTO.
    const otherEnrollment = (await enrollmentOf(other.id, made.course.id))!;
    await setLessonProgress(
      other.id,
      made.lessons[1]!.id,
      otherEnrollment.id,
      {
        status: "COMPLETED",
        quizAttempted: true,
        quizScorePercent: "95.00",
        quizIsPassed: true,
        quizSubmittedAt: new Date(),
        completedAt: new Date(),
      },
    );
    const after = await getCourseProgressPage(member, made.slug);
    expect(after).toEqual(before);
  });

  it("final questionCount is PER QUIZ: two courses, two Finals, 2 and 3 questions (mutations 13 & 21)", async () => {
    const member = await newMember("hitung");
    const two = await makeCourse("hitung-dua", {
      lessonTitles: ["Materi satu"],
    });
    const three = await makeCourse("hitung-tiga", {
      lessonTitles: ["Materi satu"],
    });
    await enrollInCourse(member, two.course.id);
    await enrollInCourse(member, three.course.id);
    // With BOTH Finals populated, a count subquery that loses its
    // quiz_id binding reads the whole questions table (5 everywhere) and a
    // bare-name binding reads 0 everywhere — only the real scoping gives
    // 2 and 3.
    await db.insert(schema.questions).values(
      [1, 2].map((order) => ({
        quizId: two.course.finalQuiz!.id,
        orderIndex: order,
        text: sql`'{"type":"doc"}'::jsonb`,
      })),
    );
    await db.insert(schema.questions).values(
      [1, 2, 3].map((order) => ({
        quizId: three.course.finalQuiz!.id,
        orderIndex: order,
        text: sql`'{"type":"doc"}'::jsonb`,
      })),
    );

    const pageTwo = await getCourseProgressPage(member, two.slug);
    const pageThree = await getCourseProgressPage(member, three.slug);
    if (pageTwo.state !== "progres" || pageThree.state !== "progres") {
      throw new Error("expected progres");
    }
    expect(pageTwo.final!.questionCount).toBe(2);
    expect(pageThree.final!.questionCount).toBe(3);
  });
});
