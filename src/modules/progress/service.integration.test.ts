// Integration tests for the progress module over PGlite (card S5-01) —
// same harness as src/modules/course/service.integration.test.ts: committed
// Drizzle migrations on a fresh in-memory database, direct user inserts,
// then the real service functions.
//
// Covers the card's integration "Selesai jika" plus the 11 Nov review
// additions:
// - available: PUBLISHED-only, with-lessons-only, not-yet-enrolled-only,
//   published_at DESC, startHref at the smallest order_index (even when
//   rows were inserted out of title order).
// - enrolled: actor's own PUBLISHED courses only (unpublish drops a row,
//   and so does deleting every lesson — the exists filter), correct
//   lesson/completed counts, lanjutkan at last_lesson_id, updated_at DESC.
// - enrollInCourse: created flags, idempotency, counter increments (and
//   courses.updated_at NOT stamped by the raw-SQL counter update), uniform
//   404s, per-course correctness of every correlated subquery with three
//   courses live (the bare-column trap of PR #129), unknown role → 403
//   BEFORE input parsing.
// - DTO allowlist: description/content never leave the module.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { courses, enrollments, lessonProgress, lessons, users } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { createCourse } from "@/modules/course/service";
import { createLesson } from "@/modules/lesson/service";

// queries.ts carries "server-only" and imports the singleton `db` from
// "@/db" — same Proxy swap as the course integration file.
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
          throw new Error("@/db mock used before the PGlite instance was installed");
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    },
  ),
}));

import { enrollInCourse, getLearnerDashboard } from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

const EDITOR = { id: "u-editor", role: "EDITOR" as const, status: "ACTIVE" as const };
const MEMBER = { id: "u-member", role: "MEMBER" as const, status: "ACTIVE" as const };
const MEMBER_B = { id: "u-member-b", role: "MEMBER" as const, status: "ACTIVE" as const };

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("../../db/migrations", import.meta.url)),
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
  return { title: `${prefix} kursu ${counter}`, slug: `${prefix}-kursu-${counter}` };
}

/** A course with `lessonTitles.length` lessons, status flipped via SQL.
 *  Building rows through the real services keeps every constraint happy
 *  (unique slugs, quiz wiring); flipping only status/published_at is the
 *  cheap part the dashboard actually reads. */
async function makeCourse(
  prefix: string,
  options: {
    lessonTitles?: string[];
    status?: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
    publishedAt?: Date;
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
    lessonRows.push(await createLesson(EDITOR, course.id, { title: lessonTitle }));
  }
  if (options.status !== undefined || options.publishedAt !== undefined) {
    await db
      .update(courses)
      .set({
        ...(options.status !== undefined ? { status: options.status } : {}),
        ...(options.publishedAt !== undefined
          ? { publishedAt: options.publishedAt }
          : {}),
      })
      .where(eq(courses.id, course.id));
  }
  return { course, lessons: lessonRows };
}

async function enrollmentOf(userId: string, courseId: string) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(sql`${enrollments.userId} = ${userId} and ${enrollments.courseId} = ${courseId}`);
  return row;
}

/** Marks the first `count` lessons of the enrollment COMPLETED (SQL — the
 *  service that writes lesson_progress arrives Kam 12). */
async function completeLessons(
  userId: string,
  courseId: string,
  count: number,
) {
  const enrollment = await enrollmentOf(userId, courseId);
  if (!enrollment) throw new Error("enrollment missing");
  const rows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(lessons.orderIndex, lessons.id);
  for (const lesson of rows.slice(0, count)) {
    await db
      .insert(lessonProgress)
      .values({
        userId,
        lessonId: lesson.id,
        enrollmentId: enrollment.id,
        status: "COMPLETED",
      })
      .onConflictDoNothing();
  }
}

// --- available -----------------------------------------------------------

describe("getLearnerDashboard — available", () => {
  it("lists only PUBLISHED courses with lessons that the actor has not joined", async () => {
    const published = await makeCourse("av1", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    const draft = await makeCourse("av2", {
      lessonTitles: ["Materi satu"],
      status: "DRAFT",
    });
    const inReview = await makeCourse("av3", {
      lessonTitles: ["Materi satu"],
      status: "IN_REVIEW",
    });
    const archived = await makeCourse("av4", {
      lessonTitles: ["Materi satu"],
      status: "ARCHIVED",
    });
    const noLessons = await makeCourse("av5", {
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    const joinedByOther = await makeCourse("av6", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await enrollInCourse(MEMBER_B, joinedByOther.course.id);
    const joinedBySelf = await makeCourse("av1b", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await enrollInCourse(MEMBER, joinedBySelf.course.id);

    const dashboard = await getLearnerDashboard(MEMBER);
    const ids = dashboard.available.map((course) => course.id);

    expect(ids).toContain(published.course.id);
    expect(ids).not.toContain(draft.course.id);
    expect(ids).not.toContain(inReview.course.id);
    expect(ids).not.toContain(archived.course.id);
    expect(ids).not.toContain(noLessons.course.id);
    // Another participant's enrollment does not hide a course from MEMBER…
    expect(ids).toContain(joinedByOther.course.id);
    // …but the ACTOR's own enrollment does (mutation 3).
    expect(ids).not.toContain(joinedBySelf.course.id);
  });

  it("orders by published_at DESC", async () => {
    const older = await makeCourse("av7", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-10-01T08:00:00Z"),
    });
    const newer = await makeCourse("av8", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });

    const dashboard = await getLearnerDashboard(MEMBER);
    const ids = dashboard.available.map((course) => course.id);
    expect(ids.indexOf(newer.course.id)).toBeLessThan(ids.indexOf(older.course.id));
  });

  it("startHref points at the smallest order_index, not the title order", async () => {
    // Created zeta FIRST (order_index 1), alpha second — "first lesson" is
    // zeta even though alpha sorts first alphabetically.
    const made = await makeCourse("av9", {
      lessonTitles: ["Materi zeta", "Materi alpha"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });

    const dashboard = await getLearnerDashboard(MEMBER);
    const row = dashboard.available.find(
      (course) => course.id === made.course.id,
    );
    expect(row?.startHref).toBe(
      `/belajar/${made.course.slug}/${made.lessons[0]!.slug}`,
    );
  });
});

// --- enrolled ------------------------------------------------------------

describe("getLearnerDashboard — enrolled", () => {
  it("lists only the actor's PUBLISHED courses, dropping unpublished ones", async () => {
    const mine = await makeCourse("en1", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    const willUnpublish = await makeCourse("en2", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    const theirs = await makeCourse("en3", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await enrollInCourse(MEMBER, mine.course.id);
    await enrollInCourse(MEMBER, willUnpublish.course.id);
    await enrollInCourse(MEMBER_B, theirs.course.id);

    let dashboard = await getLearnerDashboard(MEMBER);
    let ids = dashboard.enrolled.map((course) => course.id);
    expect(ids).toContain(mine.course.id);
    expect(ids).toContain(willUnpublish.course.id);
    expect(ids).not.toContain(theirs.course.id);

    await db
      .update(courses)
      .set({ status: "ARCHIVED" })
      .where(eq(courses.id, willUnpublish.course.id));
    dashboard = await getLearnerDashboard(MEMBER);
    ids = dashboard.enrolled.map((course) => course.id);
    expect(ids).not.toContain(willUnpublish.course.id);
  });

  it("drops an enrolled course whose lessons were all deleted (exists filter)", async () => {
    const made = await makeCourse("en4", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await enrollInCourse(MEMBER, made.course.id);

    await db.delete(lessons).where(eq(lessons.courseId, made.course.id));
    const dashboard = await getLearnerDashboard(MEMBER);
    expect(
      dashboard.enrolled.find((course) => course.id === made.course.id),
    ).toBeUndefined();
  });

  it("counts lessons and COMPLETED progress, and continues at last_lesson_id", async () => {
    const made = await makeCourse("en5", {
      lessonTitles: ["Materi satu", "Materi dua", "Materi tiga"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await enrollInCourse(MEMBER, made.course.id);

    let dashboard = await getLearnerDashboard(MEMBER);
    let row = dashboard.enrolled.find((course) => course.id === made.course.id);
    expect(row?.lessonCount).toBe(3);
    expect(row?.completedLessonCount).toBe(0);
    expect(row?.badge).toBe("belum-dimulai"); // nothing opened, nothing done

    await completeLessons(MEMBER.id, made.course.id, 1);
    dashboard = await getLearnerDashboard(MEMBER);
    row = dashboard.enrolled.find((course) => course.id === made.course.id);
    expect(row?.completedLessonCount).toBe(1);
    // Completed progress alone (last_lesson_id arrives Kam 12) is already
    // "sedang-berjalan" per the PRG-06 rule.
    expect(row?.badge).toBe("sedang-berjalan");

    await db
      .update(enrollments)
      .set({ lastLessonId: made.lessons[1]!.id })
      .where(
        sql`${enrollments.userId} = ${MEMBER.id} and ${enrollments.courseId} = ${made.course.id}`,
      );
    dashboard = await getLearnerDashboard(MEMBER);
    row = dashboard.enrolled.find((course) => course.id === made.course.id);
    expect(row?.badge).toBe("sedang-berjalan");
    expect(row?.action).toEqual({
      kind: "lanjutkan",
      href: `/belajar/${made.course.slug}/${made.lessons[1]!.slug}`,
    });
  });

  it("orders by enrollments.updated_at DESC (the dashboard's activity order)", async () => {
    const first = await makeCourse("en6", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    const second = await makeCourse("en7", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await enrollInCourse(MEMBER, first.course.id);
    await enrollInCourse(MEMBER, second.course.id);

    // Pin BOTH timestamps (other tests' enrollments carry real-now values
    // and must not decide this assertion): first is the newer one.
    await db
      .update(enrollments)
      .set({ updatedAt: new Date("2026-11-05T09:00:00Z") })
      .where(
        sql`${enrollments.userId} = ${MEMBER.id} and ${enrollments.courseId} = ${first.course.id}`,
      );
    await db
      .update(enrollments)
      .set({ updatedAt: new Date("2026-11-04T09:00:00Z") })
      .where(
        sql`${enrollments.userId} = ${MEMBER.id} and ${enrollments.courseId} = ${second.course.id}`,
      );

    const dashboard = await getLearnerDashboard(MEMBER);
    const ids = dashboard.enrolled.map((course) => course.id);
    expect(ids.indexOf(first.course.id)).toBeLessThan(
      ids.indexOf(second.course.id),
    );
  });
});

// --- per-course correctness with several courses live (PR #129 trap) ----

describe("correlated subqueries stay per-course with three courses live", () => {
  it("returns each course's own counts and first lesson slug", async () => {
    // Distinct lesson counts (1 / 2 / 3) so a subquery bound to the wrong
    // course changes the number, not just its owner.
    const solo = await makeCourse("mc1", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    const duo = await makeCourse("mc2", {
      lessonTitles: ["Materi satu", "Materi dua"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-02T08:00:00Z"),
    });
    const trio = await makeCourse("mc3", {
      lessonTitles: ["Materi satu", "Materi dua", "Materi tiga"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-03T08:00:00Z"),
    });

    await enrollInCourse(MEMBER, solo.course.id);
    await enrollInCourse(MEMBER, trio.course.id);
    await completeLessons(MEMBER.id, trio.course.id, 2);

    const dashboard = await getLearnerDashboard(MEMBER);
    const enrolledById = new Map(dashboard.enrolled.map((c) => [c.id, c]));

    const soloRow = enrolledById.get(solo.course.id);
    expect(soloRow?.lessonCount).toBe(1);
    expect(soloRow?.completedLessonCount).toBe(0);
    expect(soloRow?.action.href).toBe(
      `/belajar/${solo.course.slug}/${solo.lessons[0]!.slug}`,
    );

    const trioRow = enrolledById.get(trio.course.id);
    expect(trioRow?.lessonCount).toBe(3);
    expect(trioRow?.completedLessonCount).toBe(2);
    expect(trioRow?.action.href).toBe(
      `/belajar/${trio.course.slug}/${trio.lessons[0]!.slug}`,
    );

    // And the not-enrolled duo still counts correctly on the other list.
    const duoRow = dashboard.available.find((c) => c.id === duo.course.id);
    expect(duoRow?.lessonCount).toBe(2);
    expect(duoRow?.startHref).toBe(
      `/belajar/${duo.course.slug}/${duo.lessons[0]!.slug}`,
    );
  });
});

// --- enrollInCourse ------------------------------------------------------

describe("enrollInCourse", () => {
  it("creates one enrollment, bumps the counter, leaves courses.updated_at alone", async () => {
    const made = await makeCourse("ro1", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    // Pin updated_at: the counter update is RAW SQL precisely so this
    // timestamp does not move (owner review 11 Nov no. 2 — a typed update
    // would stamp it via $onUpdate and reshuffle CMS lists).
    const pinnedAt = new Date("2026-10-31T08:00:00Z");
    await db
      .update(courses)
      .set({ updatedAt: pinnedAt })
      .where(eq(courses.id, made.course.id));

    const result = await enrollInCourse(MEMBER, made.course.id);
    expect(result.created).toBe(true);
    expect(result.data.startHref).toBe(
      `/belajar/${made.course.slug}/${made.lessons[0]!.slug}`,
    );

    const rows = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.courseId, made.course.id));
    expect(rows).toHaveLength(1);

    const [courseRow] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, made.course.id));
    expect(courseRow?.enrollmentCount).toBe(1);
    expect(courseRow?.updatedAt.getTime()).toBe(pinnedAt.getTime());
  });

  it("is idempotent: second call → created:false, one row, counter unchanged, same startHref", async () => {
    const made = await makeCourse("ro2", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    const first = await enrollInCourse(MEMBER, made.course.id);
    const second = await enrollInCourse(MEMBER, made.course.id);

    expect(second.created).toBe(false);
    expect(second.data.startHref).toBe(first.data.startHref);

    const rows = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.courseId, made.course.id));
    expect(rows).toHaveLength(1);
    const [courseRow] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, made.course.id));
    expect(courseRow?.enrollmentCount).toBe(1);
  });

  it("a returning participant is taken to their last lesson, not the first", async () => {
    const made = await makeCourse("ro3", {
      lessonTitles: ["Materi satu", "Materi dua"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await enrollInCourse(MEMBER, made.course.id);
    await db
      .update(enrollments)
      .set({ lastLessonId: made.lessons[1]!.id })
      .where(
        sql`${enrollments.userId} = ${MEMBER.id} and ${enrollments.courseId} = ${made.course.id}`,
      );

    const again = await enrollInCourse(MEMBER, made.course.id);
    expect(again.created).toBe(false);
    expect(again.data.startHref).toBe(
      `/belajar/${made.course.slug}/${made.lessons[1]!.slug}`,
    );
  });

  it("404s uniformly (draft, in review, unknown id, published without lessons, non-UUID) without writing", async () => {
    const draft = await makeCourse("ro4", {
      lessonTitles: ["Materi satu"],
      status: "DRAFT",
    });
    const inReview = await makeCourse("ro5", {
      lessonTitles: ["Materi satu"],
      status: "IN_REVIEW",
    });
    const noLessons = await makeCourse("ro6", {
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    const unknownId = "0e000000-0000-4000-8000-000000000000";

    for (const id of [
      draft.course.id,
      inReview.course.id,
      noLessons.course.id,
      unknownId,
      "bukan-uuid",
    ]) {
      await expect(enrollInCourse(MEMBER, id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    }

    // Nothing was written for any of them.
    const allEnrollments = await db.select().from(enrollments);
    const touched = allEnrollments.filter(
      (row) =>
        row.courseId === draft.course.id ||
        row.courseId === inReview.course.id ||
        row.courseId === noLessons.course.id ||
        row.courseId === unknownId,
    );
    expect(touched).toHaveLength(0);
    const counts = await db
      .select({ enrollmentCount: courses.enrollmentCount })
      .from(courses)
      .where(eq(courses.id, noLessons.course.id));
    expect(counts[0]?.enrollmentCount).toBe(0);
  });

  it("a second participant gets their own row and drives the counter to 2", async () => {
    const made = await makeCourse("ro7", {
      lessonTitles: ["Materi satu"],
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await enrollInCourse(MEMBER, made.course.id);
    const second = await enrollInCourse(MEMBER_B, made.course.id);
    expect(second.created).toBe(true);

    const rows = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.courseId, made.course.id));
    expect(rows).toHaveLength(2);
    const [courseRow] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, made.course.id));
    expect(courseRow?.enrollmentCount).toBe(2);
  });
});

// --- guards & serialization ----------------------------------------------

describe("guards and DTO allowlist", () => {
  it("rejects an unknown role with 403 BEFORE parsing the id (role-first guard order)", async () => {
    const ghost = {
      id: MEMBER.id,
      role: "GHOST" as "MEMBER",
      status: "ACTIVE" as const,
    };
    await expect(getLearnerDashboard(ghost)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    // Non-UUID id would 404 if parsed first — the 403 wins.
    await expect(enrollInCourse(ghost, "bukan-uuid")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("never exposes courses.description through either DTO", async () => {
    const dashboard = await getLearnerDashboard(MEMBER);
    expect(dashboard.available.length).toBeGreaterThan(0);
    for (const course of dashboard.available) {
      expect("description" in course).toBe(false);
    }
    for (const course of dashboard.enrolled) {
      expect("description" in course).toBe(false);
    }
  });
});
