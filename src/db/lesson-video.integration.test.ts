// Integration tests for the video-source CHECK and setLessonYouTubeVideo
// (card S2-02 §1/§8) over PGlite — same harness as the progress module:
// committed Drizzle migrations on a fresh in-memory database (so the CHECK
// is read from the REAL 0001_video_source.sql file, not the TS schema —
// that is what mutations 1 and 2 rely on), direct user inserts, real
// course/lesson services to build rows, then direct updates.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { courses, lessons, users } from "@/db/schema";
import { createCourse } from "@/modules/course/service";
import { createLesson } from "@/modules/lesson/service";

import { setLessonYouTubeVideo } from "./lesson-video";

// Same "@/db" Proxy swap as the progress-module harness: createCourse /
// createLesson pull the singleton, the tests point it at PGlite.
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

const EDITOR = {
  id: "u-editor",
  role: "EDITOR" as const,
  status: "ACTIVE" as const,
};

const VALID_ID = "e2eVideo001"; // 11 chars

let pglite: PGlite;
let db: Db;

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
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

/** A draft course with one lesson; returns ids + slugs for updates. The
 *  counter keeps every call's title/slug unique — the course service
 *  rejects titles too similar to an existing course, and it.each rows
 *  would otherwise collide from the second row on. */
let counter = 0;
async function madeLesson(prefix: string) {
  counter += 1;
  const course = await createCourse(EDITOR, {
    title: `${prefix} kursus ${counter}`,
    slug: `${prefix}-kursu-${counter}`,
    level: "BEGINNER",
    summary: "Ringkasan netral untuk tes.",
  });
  const lesson = await createLesson(EDITOR, course.id, {
    title: `${prefix} materi`,
  });
  const courseRow = (
    await db
      .select({ updatedAt: courses.updatedAt })
      .from(courses)
      .where(eq(courses.id, course.id))
  )[0]!;
  return {
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: course.title,
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
    courseUpdatedAt: courseRow.updatedAt,
  };
}

/** Read the video columns of one lesson row. */
async function videoColumns(lessonId: string) {
  const rows = await db
    .select({
      videoProvider: lessons.videoProvider,
      videoExternalId: lessons.videoExternalId,
      videoStatus: lessons.videoStatus,
      videoDurationSeconds: lessons.videoDurationSeconds,
      videoKey: lessons.videoKey,
    })
    .from(lessons)
    .where(eq(lessons.id, lessonId));
  return rows[0]!;
}

// --- the CHECK itself (card §1, mutation 1 & 2 target this file's SQL) ---

describe("lessons_video_source_check", () => {
  it.each([
    ["READY without a source", { videoStatus: "READY" as const }],
    [
      "READY + YOUTUBE without an id",
      { videoStatus: "READY" as const, videoProvider: "YOUTUBE" as const },
    ],
    [
      "READY + YOUTUBE with a 10-char id",
      {
        videoStatus: "READY" as const,
        videoProvider: "YOUTUBE" as const,
        videoExternalId: "e2eVideo00",
      },
    ],
    [
      "READY + YOUTUBE with an id containing /",
      {
        videoStatus: "READY" as const,
        videoProvider: "YOUTUBE" as const,
        videoExternalId: "e2eVideo0/1",
      },
    ],
    [
      "READY + R2 without video_key",
      { videoStatus: "READY" as const, videoProvider: "R2" as const },
    ],
    [
      "READY + R2 with only a YouTube id",
      {
        videoStatus: "READY" as const,
        videoProvider: "R2" as const,
        videoExternalId: VALID_ID,
      },
    ],
  ])("rejects: %s", async (_label, columns) => {
    const made = await madeLesson("vcrej");
    await expect(
      db.update(lessons).set(columns).where(eq(lessons.id, made.lessonId)),
    ).rejects.toThrow();
  });

  it.each([
    ["NONE without a source", { videoStatus: "NONE" as const }],
    ["UPLOADING without a source", { videoStatus: "UPLOADING" as const }],
    [
      "READY + YOUTUBE + an 11-char id",
      {
        videoStatus: "READY" as const,
        videoProvider: "YOUTUBE" as const,
        videoExternalId: VALID_ID,
      },
    ],
    [
      "READY + R2 + video_key",
      {
        videoStatus: "READY" as const,
        videoProvider: "R2" as const,
        videoKey: "kursus/materi-1.mp4",
      },
    ],
  ])("accepts: %s", async (_label, columns) => {
    const made = await madeLesson("vceok");
    await expect(
      db.update(lessons).set(columns).where(eq(lessons.id, made.lessonId)),
    ).resolves.toBeDefined();
    expect(await videoColumns(made.lessonId)).toMatchObject(columns);
  });
});

// --- setLessonYouTubeVideo (card §8) ---------------------------------------

describe("setLessonYouTubeVideo", () => {
  it("sets all five columns and returns the titles + previous values", async () => {
    const made = await madeLesson("sv1");
    const result = await setLessonYouTubeVideo(db, {
      courseSlug: made.courseSlug,
      lessonSlug: made.lessonSlug,
      videoId: VALID_ID,
      durationSeconds: 120,
    });
    expect(result.courseTitle).toBe(made.courseTitle);
    expect(result.lessonTitle).toBe(made.lessonTitle);
    expect(result.previous).toEqual({
      videoProvider: null,
      videoExternalId: null,
      videoStatus: "NONE",
      videoDurationSeconds: null,
    });
    expect(await videoColumns(made.lessonId)).toEqual({
      videoProvider: "YOUTUBE",
      videoExternalId: VALID_ID,
      videoStatus: "READY",
      videoDurationSeconds: 120,
      videoKey: null,
    });
  });

  it("running it again overwrites the old id and duration", async () => {
    const made = await madeLesson("sv2");
    await setLessonYouTubeVideo(db, {
      courseSlug: made.courseSlug,
      lessonSlug: made.lessonSlug,
      videoId: VALID_ID,
      durationSeconds: 120,
    });
    const second = await setLessonYouTubeVideo(db, {
      courseSlug: made.courseSlug,
      lessonSlug: made.lessonSlug,
      videoId: "e2eVideo002",
      durationSeconds: 90,
    });
    expect(second.previous).toEqual({
      videoProvider: "YOUTUBE",
      videoExternalId: VALID_ID,
      videoStatus: "READY",
      videoDurationSeconds: 120,
    });
    expect(await videoColumns(made.lessonId)).toEqual({
      videoProvider: "YOUTUBE",
      videoExternalId: "e2eVideo002",
      videoStatus: "READY",
      videoDurationSeconds: 90,
      videoKey: null,
    });
  });

  it("clears a stale R2 source: video_key becomes NULL", async () => {
    const made = await madeLesson("sv3");
    await db
      .update(lessons)
      .set({
        videoStatus: "READY",
        videoProvider: "R2",
        videoKey: "kursus/materi-1.mp4",
      })
      .where(eq(lessons.id, made.lessonId));
    await setLessonYouTubeVideo(db, {
      courseSlug: made.courseSlug,
      lessonSlug: made.lessonSlug,
      videoId: VALID_ID,
      durationSeconds: 60,
    });
    expect((await videoColumns(made.lessonId)).videoKey).toBeNull();
  });

  it("an unknown slug pair → a clear error and no row changed", async () => {
    const made = await madeLesson("sv4");
    await setLessonYouTubeVideo(db, {
      courseSlug: made.courseSlug,
      lessonSlug: made.lessonSlug,
      videoId: VALID_ID,
      durationSeconds: 60,
    });
    const before = await videoColumns(made.lessonId);

    await expect(
      setLessonYouTubeVideo(db, {
        courseSlug: "kursus-tak-ada",
        lessonSlug: made.lessonSlug,
        videoId: VALID_ID,
        durationSeconds: 60,
      }),
    ).rejects.toThrow(/tidak ditemukan/);
    await expect(
      setLessonYouTubeVideo(db, {
        courseSlug: made.courseSlug,
        lessonSlug: "materi-tak-ada",
        videoId: VALID_ID,
        durationSeconds: 60,
      }),
    ).rejects.toThrow(/tidak ditemukan/);
    expect(await videoColumns(made.lessonId)).toEqual(before);
  });

  it("an invalid video id → an error before anything is written", async () => {
    const made = await madeLesson("sv5");
    await expect(
      setLessonYouTubeVideo(db, {
        courseSlug: made.courseSlug,
        lessonSlug: made.lessonSlug,
        videoId: "pendek",
        durationSeconds: 60,
      }),
    ).rejects.toThrow(/ID video tidak sah/);
    expect((await videoColumns(made.lessonId)).videoStatus).toBe("NONE");
  });

  it("courses.updated_at never moves", async () => {
    const made = await madeLesson("sv6");
    await setLessonYouTubeVideo(db, {
      courseSlug: made.courseSlug,
      lessonSlug: made.lessonSlug,
      videoId: VALID_ID,
      durationSeconds: 60,
    });
    const after = (
      await db
        .select({ updatedAt: courses.updatedAt })
        .from(courses)
        .where(eq(courses.id, made.courseId))
    )[0]!;
    expect(after.updatedAt.getTime()).toBe(made.courseUpdatedAt.getTime());
  });
});
