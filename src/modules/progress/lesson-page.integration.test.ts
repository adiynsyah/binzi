// Integration tests for the lesson page + gate + open/video writes (card
// S2-01) over PGlite — same harness as service.integration.test.ts:
// committed Drizzle migrations on a fresh in-memory database, direct user
// inserts, real course/lesson services to build rows, then the real
// progress service functions.
//
// Covers the card's integration "Selesai jika":
// - 404s: unknown course slug; DRAFT/IN_REVIEW/ARCHIVED courses; unknown
//   lesson slug; another course's lesson slug.
// - not-enrolled: no content, no progress.
// - Sequential gate: locked → unlock { position: 1 }; quiz_attempted on
//   the DIRECT predecessor opens the next lesson only.
// - Non-sequential: everything open.
// - Positions follow order_index (30/10/20 → 1/2/3), never the raw value.
// - Dashboard consistency: page position 1 == dashboard startHref target,
//   including the shared-order_index id tie-break.
// - Two participants never mix outline rows.
// - openLesson: the upsert invariants (idempotent, COMPLETED never
//   downgraded, first_accessed_at kept), last_lesson_id + enrollment
//   updated_at move, courses.updated_at never does.
// - recordVideoProgress: monotonic percent, stored duration wins (also
//   when the column is 0 — no Infinity), cap at 100, READY requirement,
//   locked 409, returned values are the STORED ones (number, not string).
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
import { ConflictError, NotFoundError } from "@/lib/errors";
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
          Record<string | symbol, unknown> | undefined;
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
  getLearnerDashboard,
  getLessonPage,
  lessonHref,
  openLesson,
  recordVideoProgress,
} from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

const EDITOR = {
  id: "u-editor",
  role: "EDITOR" as const,
  status: "ACTIVE" as const,
};
const MEMBER = {
  id: "u-member",
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
};
const MEMBER_B = {
  id: "u-member-b",
  role: "MEMBER" as const,
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

  await db.insert(users).values([
    {
      id: EDITOR.id,
      name: "Editor Satu",
      email: "editor@example.com",
      emailVerified: true,
      role: "EDITOR",
    },
    {
      id: MEMBER.id,
      name: "Member Satu",
      email: "member@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
    {
      id: MEMBER_B.id,
      name: "Member Dua",
      email: "member-b@example.com",
      emailVerified: true,
      role: "MEMBER",
    },
  ]);
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

/** Ordered lesson ids of the course (order_index asc, id asc). */
async function orderedLessonIds(courseId: string): Promise<string[]> {
  const rows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(lessons.orderIndex, lessons.id);
  return rows.map((row) => row.id);
}

/** Flip quiz_attempted for the lesson at `position` (the quiz card's write). */
async function attemptQuizAt(
  userId: string,
  courseId: string,
  position: number,
) {
  const enrollment = await enrollmentOf(userId, courseId);
  if (!enrollment) throw new Error("enrollment missing");
  const lessonId = (await orderedLessonIds(courseId))[position - 1]!;
  await db
    .insert(lessonProgress)
    .values({
      userId,
      lessonId,
      enrollmentId: enrollment.id,
      quizAttempted: true,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { quizAttempted: true },
    });
}

async function progressRow(userId: string, lessonId: string) {
  const [row] = await db
    .select()
    .from(lessonProgress)
    .where(
      sql`${lessonProgress.userId} = ${userId} and ${lessonProgress.lessonId} = ${lessonId}`,
    );
  return row;
}

async function courseUpdatedAt(courseId: string): Promise<Date> {
  const [row] = await db
    .select({ updatedAt: courses.updatedAt })
    .from(courses)
    .where(eq(courses.id, courseId));
  return row!.updatedAt;
}

/** A sequential PUBLISHED 3-lesson course the MEMBER is enrolled in. */
async function enrolledSequentialCourse(prefix: string) {
  const made = await makeCourse(prefix, {
    lessonTitles: ["Materi alpha", "Materi beta", "Materi gamma"],
  });
  await enrollInCourse(MEMBER, made.course.id);
  return made;
}

// --- getLessonPage: 404s --------------------------------------------------

describe("getLessonPage — 404", () => {
  it("unknown course slug", async () => {
    await expect(
      getLessonPage(MEMBER, "kursus-tak-ada", "apapun"),
    ).rejects.toThrow(NotFoundError);
  });

  it.each(["DRAFT", "IN_REVIEW", "ARCHIVED"] as const)(
    "%s course answers the same 404 (no status leak)",
    async (status) => {
      const made = await makeCourse("lp404", {
        lessonTitles: ["Materi satu"],
        status,
      });
      await expect(
        getLessonPage(MEMBER, made.slug, made.lessons[0]!.slug),
      ).rejects.toThrow(NotFoundError);
    },
  );

  it("unknown lesson slug within a published course", async () => {
    const made = await makeCourse("lp404d", { lessonTitles: ["Materi satu"] });
    await expect(
      getLessonPage(MEMBER, made.slug, "materi-tak-ada"),
    ).rejects.toThrow(NotFoundError);
  });

  it("another course's lesson slug", async () => {
    // Distinct titles: the slug comes from the title, and uniqueness is
    // per-course — identical titles would mint the SAME slug in both
    // courses and resolve "legitimately" in the wrong one.
    const a = await makeCourse("lp404e", { lessonTitles: ["Materi satu"] });
    const b = await makeCourse("lp404f", { lessonTitles: ["Materi lain"] });
    await expect(
      getLessonPage(MEMBER, a.slug, b.lessons[0]!.slug),
    ).rejects.toThrow(NotFoundError);
  });
});

// --- getLessonPage: states -------------------------------------------------

describe("getLessonPage — not-enrolled", () => {
  it("answers the panel shape without content or progress", async () => {
    const made = await makeCourse("lpne", { lessonTitles: ["Materi satu"] });
    const dto = await getLessonPage(MEMBER, made.slug, made.lessons[0]!.slug);
    expect(dto.state).toBe("not-enrolled");
    expect("content" in dto && dto.content).toBeFalsy();
    expect("progress" in dto).toBe(false);
    expect(dto.course).toEqual({
      id: made.course.id,
      title: made.course.title,
    });
    expect(dto.lesson.position).toBe(1);
  });
});

describe("getLessonPage — sequential gate", () => {
  it("lesson 2 is locked with unlock { position: 1 } until quiz 1 is attempted", async () => {
    const made = await enrolledSequentialCourse("lpg1");
    const dto = await getLessonPage(MEMBER, made.slug, made.lessons[1]!.slug);
    expect(dto.state).toBe("locked");
    if (dto.state !== "locked") return;
    expect(dto.unlock).toEqual({
      position: 1,
      href: lessonHref(made.slug, made.lessons[0]!.slug),
    });
    expect("content" in dto && dto.content).toBeFalsy();

    await attemptQuizAt(MEMBER.id, made.course.id, 1);
    const after = await getLessonPage(MEMBER, made.slug, made.lessons[1]!.slug);
    expect(after.state).toBe("open");
  });

  it("lesson 3 opens ONLY when quiz 2 is attempted (direct predecessor)", async () => {
    const made = await enrolledSequentialCourse("lpg2");
    await attemptQuizAt(MEMBER.id, made.course.id, 1);

    const stillLocked = await getLessonPage(
      MEMBER,
      made.slug,
      made.lessons[2]!.slug,
    );
    expect(stillLocked.state).toBe("locked");

    await attemptQuizAt(MEMBER.id, made.course.id, 2);
    const open = await getLessonPage(MEMBER, made.slug, made.lessons[2]!.slug);
    expect(open.state).toBe("open");
  });
});

describe("getLessonPage — non-sequential", () => {
  it("every lesson is open without any quiz attempted", async () => {
    const made = await makeCourse("lpns", {
      lessonTitles: ["Materi alpha", "Materi beta", "Materi gamma"],
      isSequential: false,
    });
    await enrollInCourse(MEMBER, made.course.id);
    for (const lesson of made.lessons) {
      const dto = await getLessonPage(MEMBER, made.slug, lesson.slug);
      expect(dto.state, lesson.slug).toBe("open");
    }
  });
});

describe("getLessonPage — positions follow order_index, never its value", () => {
  it("order_index 30/10/20 inserted out of order → positions 1/2/3", async () => {
    const made = await enrolledSequentialCourse("lppos");
    for (const [lesson, orderIndex] of [
      [made.lessons[0]!, 30],
      [made.lessons[1]!, 10],
      [made.lessons[2]!, 20],
    ] as const) {
      await db
        .update(lessons)
        .set({ orderIndex })
        .where(eq(lessons.id, lesson.id));
    }
    // beta(10)=1, gamma(20)=2, alpha(30)=3 — assert via each page's outline.
    const beta = await getLessonPage(MEMBER, made.slug, made.lessons[1]!.slug);
    expect(beta.state).toBe("open");
    if (beta.state !== "open") return;
    expect(beta.lesson.position).toBe(1);
    expect(beta.outline.map((item) => item.title)).toEqual([
      "Materi beta",
      "Materi gamma",
      "Materi alpha",
    ]);
    expect(beta.outline.map((item) => item.position)).toEqual([1, 2, 3]);
  });
});

describe("getLessonPage — dashboard consistency", () => {
  it("page position 1 is the dashboard startHref target (shared order_index tie-breaks by id)", async () => {
    const made = await enrolledSequentialCourse("lpkons");
    // ALL lessons share order_index 5, so both the dashboard's
    // firstLessonSlugSql and the outline's ORDER BY must tie-break by id —
    // and name the SAME lesson.
    for (const lesson of made.lessons) {
      await db
        .update(lessons)
        .set({ orderIndex: 5 })
        .where(eq(lessons.id, lesson.id));
    }

    const dashboard = await getLearnerDashboard(MEMBER);
    const row = dashboard.enrolled.find((entry) => entry.id === made.course.id);
    expect(row).toBeDefined();
    // Fresh enrollment → the "mulai" action targets the first lesson.
    expect(row!.action.kind).toBe("mulai");

    const firstSlug = row!.action.href.split("/").pop()!;
    const page = await getLessonPage(MEMBER, made.slug, firstSlug);
    expect(page.state).toBe("open");
    if (page.state !== "open") return;
    expect(page.lesson.position).toBe(1);
    expect(page.outline[0]!.position).toBe(1);
    expect(page.outline[0]!.href).toBe(row!.action.href);
  });
});

describe("getLessonPage — per-participant outline", () => {
  it("member B's COMPLETED row never leaks into member A's outline", async () => {
    const made = await enrolledSequentialCourse("lpmix");
    await enrollInCourse(MEMBER_B, made.course.id);
    const ids = await orderedLessonIds(made.course.id);
    await db.insert(lessonProgress).values({
      userId: MEMBER_B.id,
      lessonId: ids[0]!,
      enrollmentId: (await enrollmentOf(MEMBER_B.id, made.course.id))!.id,
      status: "COMPLETED",
    });

    const dto = await getLessonPage(MEMBER, made.slug, made.lessons[0]!.slug);
    if (dto.state === "not-enrolled") throw new Error("expected enrolled page");
    expect(dto.outline).toHaveLength(3);
    expect(dto.outline.some((item) => item.state === "selesai")).toBe(false);
  });
});

// --- openLesson -------------------------------------------------------------

describe("openLesson", () => {
  it("first open: one IN_PROGRESS row, first_accessed_at set, last_lesson_id moved, enrollment updated_at raised, courses.updated_at untouched", async () => {
    const made = await enrolledSequentialCourse("op1");
    const lessonId = made.lessons[0]!.id;
    // Pin the enrollment stamp: the enroll transaction itself writes
    // updated_at, and same-millisecond writes would hide the move.
    await db
      .update(enrollments)
      .set({ updatedAt: new Date("2026-11-01T08:00:00Z") })
      .where(
        eq(enrollments.id, (await enrollmentOf(MEMBER.id, made.course.id))!.id),
      );
    const courseBefore = await courseUpdatedAt(made.course.id);

    await openLesson(MEMBER, lessonId);

    const row = await progressRow(MEMBER.id, lessonId);
    expect(row).toBeDefined();
    expect(row!.status).toBe("IN_PROGRESS");
    expect(row!.firstAccessedAt).not.toBeNull();
    expect(row!.quizAttempted).toBe(false);

    const enrollment = await enrollmentOf(MEMBER.id, made.course.id);
    expect(enrollment!.lastLessonId).toBe(lessonId);
    expect(enrollment!.updatedAt.getTime()).toBeGreaterThan(
      new Date("2026-11-01T08:00:00Z").getTime(),
    );
    expect((await courseUpdatedAt(made.course.id)).getTime()).toBe(
      courseBefore.getTime(),
    );
  });

  it("second open: same first_accessed_at, still one row", async () => {
    const made = await enrolledSequentialCourse("op2");
    const lessonId = made.lessons[0]!.id;
    await openLesson(MEMBER, lessonId);
    const first = (await progressRow(MEMBER.id, lessonId))!.firstAccessedAt;

    await openLesson(MEMBER, lessonId);
    const rows = await db
      .select()
      .from(lessonProgress)
      .where(
        sql`${lessonProgress.userId} = ${MEMBER.id} and ${lessonProgress.lessonId} = ${lessonId}`,
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.firstAccessedAt?.getTime()).toBe(first?.getTime());
  });

  it("a COMPLETED row never downgrades", async () => {
    const made = await enrolledSequentialCourse("op3");
    const lessonId = made.lessons[0]!.id;
    await openLesson(MEMBER, lessonId);
    await db
      .update(lessonProgress)
      .set({ status: "COMPLETED" })
      .where(
        sql`${lessonProgress.userId} = ${MEMBER.id} and ${lessonProgress.lessonId} = ${lessonId}`,
      );

    await openLesson(MEMBER, lessonId);
    expect((await progressRow(MEMBER.id, lessonId))!.status).toBe("COMPLETED");
  });

  it("locked lesson → ConflictError and no row written", async () => {
    const made = await enrolledSequentialCourse("op4");
    const lessonId = made.lessons[1]!.id;
    await expect(openLesson(MEMBER, lessonId)).rejects.toThrow(ConflictError);
    expect(await progressRow(MEMBER.id, made.lessons[1]!.id)).toBeUndefined();
  });

  it("not enrolled (or enrolled in ANOTHER course) → NotFoundError", async () => {
    // `made` has NO enrollment for anyone; `other` is where MEMBER is
    // enrolled — the enrollment must be matched per-course, not per-user.
    const made = await makeCourse("op5", {
      lessonTitles: ["Materi alpha", "Materi beta"],
    });
    const other = await makeCourse("op5b", { lessonTitles: ["Materi satu"] });
    await enrollInCourse(MEMBER, other.course.id);

    // MEMBER_B never enrolled anywhere.
    await expect(openLesson(MEMBER_B, made.lessons[0]!.id)).rejects.toThrow(
      NotFoundError,
    );
    // MEMBER is enrolled in `other`, not in `made`.
    await expect(openLesson(MEMBER, made.lessons[0]!.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("non-UUID id → the same NotFoundError (no id probing)", async () => {
    await expect(openLesson(MEMBER, "bukan-uuid")).rejects.toThrow(
      NotFoundError,
    );
  });
});

// --- recordVideoProgress ------------------------------------------------------

describe("recordVideoProgress", () => {
  /** Enrolled course whose FIRST lesson carries the given video columns. */
  async function videoCourse(
    prefix: string,
    video: { status: "NONE" | "READY"; durationSeconds: number | null },
  ) {
    const made = await enrolledSequentialCourse(prefix);
    await db
      .update(lessons)
      .set({
        videoStatus: video.status,
        videoDurationSeconds: video.durationSeconds,
      })
      .where(eq(lessons.id, made.lessons[0]!.id));
    return made;
  }

  it("50% then 20%: percent stays 50 (monotonic), position follows, returned values are stored", async () => {
    const made = await videoCourse("vd1", {
      status: "READY",
      durationSeconds: 100,
    });
    const lessonId = made.lessons[0]!.id;

    const first = await recordVideoProgress(MEMBER, {
      lessonId,
      positionSeconds: 50,
      durationSeconds: 100,
    });
    expect(first).toEqual({ positionSeconds: 50, watchedPercent: 50 });
    expect(typeof first.watchedPercent).toBe("number");

    const second = await recordVideoProgress(MEMBER, {
      lessonId,
      positionSeconds: 20,
      durationSeconds: 100,
    });
    expect(second).toEqual({ positionSeconds: 20, watchedPercent: 50 });

    const row = await progressRow(MEMBER.id, lessonId);
    expect(row!.videoLastPositionSeconds).toBe(20);
    expect(row!.videoWatchedPercent).toBe("50.00");
  });

  it("stored video_duration_seconds wins over the player's report", async () => {
    const made = await videoCourse("vd2", {
      status: "READY",
      durationSeconds: 200,
    });
    const result = await recordVideoProgress(MEMBER, {
      lessonId: made.lessons[0]!.id,
      positionSeconds: 100,
      durationSeconds: 400,
    });
    expect(result.watchedPercent).toBe(50);
  });

  it("a stored duration of 0 must not divide — the player's report is used", async () => {
    const made = await videoCourse("vd3", {
      status: "READY",
      durationSeconds: 0,
    });
    const result = await recordVideoProgress(MEMBER, {
      lessonId: made.lessons[0]!.id,
      positionSeconds: 50,
      durationSeconds: 100,
    });
    expect(result.watchedPercent).toBe(50);
    expect(Number.isFinite(result.watchedPercent)).toBe(true);
  });

  it("position past the duration caps at 100 (the 5 s tolerance ceiling)", async () => {
    const made = await videoCourse("vd4", {
      status: "READY",
      durationSeconds: null,
    });
    const result = await recordVideoProgress(MEMBER, {
      lessonId: made.lessons[0]!.id,
      positionSeconds: 105,
      durationSeconds: 100,
    });
    expect(result.watchedPercent).toBe(100);
  });

  it("video_status ≠ READY → ConflictError; locked lesson → ConflictError", async () => {
    const made = await videoCourse("vd5", {
      status: "NONE",
      durationSeconds: 100,
    });
    await expect(
      recordVideoProgress(MEMBER, {
        lessonId: made.lessons[0]!.id,
        positionSeconds: 10,
        durationSeconds: 100,
      }),
    ).rejects.toThrow(ConflictError);

    const ready = await videoCourse("vd6", {
      status: "READY",
      durationSeconds: 100,
    });
    await expect(
      recordVideoProgress(MEMBER, {
        lessonId: ready.lessons[1]!.id,
        positionSeconds: 10,
        durationSeconds: 100,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
