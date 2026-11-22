// Integration tests for the PUBLIC course reads (card S6-02) over PGlite —
// same harness pattern as service.integration.test.ts: committed Drizzle
// migrations on a fresh in-memory database, direct inserts, then the real
// service functions.
//
// Covers the card's "Selesai jika" (integrasi):
// - getPublicCatalog: only PUBLISHED courses WITH lessons appear (DRAFT,
//   IN_REVIEW, ARCHIVED, and a lesson-less PUBLISHED course never do);
//   order published_at desc, id asc with both written explicitly so the
//   id order, the insert order, and the expected order all differ; the
//   per-course lesson count (2 and 3 in ONE test); estimatedMinutes and
//   summary null/filled.
// - getPublicCourse: the uniform NotFoundError (unknown slug, DRAFT,
//   ARCHIVED, PUBLISHED without lessons); the outline order (order_index
//   asc, id asc on a shared order_index); durationSeconds only for READY
//   with duration > 0; hasFinalQuiz and the meta fallbacks.
//
// Every test builds its OWN courses (tokened slugs), so `-t` runs of a
// single test carry their own data. List assertions are existence-based
// by slug (STATUS 9 Nov lesson 9).
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { courses, lessons, quizzes, users } from "@/db/schema";
import { EMPTY_DOC } from "@/lib/content-doc";
import { NotFoundError } from "@/lib/errors";

// queries.ts carries "server-only" and imports the singleton `db` from
// "@/db" — same mock shape as service.integration.test.ts (Proxy over the
// PGlite instance installed in beforeAll, vi.hoisted keeps it alive).
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

import { getPublicCatalog, getPublicCourse } from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

/** The creator of every course row here (created_by/updated_by FK). */
const EDITOR_ID = "u-editor-catalog";

/** A valid UUID whose last 12 hex digits zero-pad `seed` — ascending seeds
 *  give ascending ids without relying on defaultRandom. */
function uuid(seed: number): string {
  return `00000000-0000-4000-8000-${seed.toString(16).padStart(12, "0")}`;
}

/** Auto ids for rows that do not care: a monotonic counter far above the
 *  hand-picked seeds below, so the two can never collide. */
let autoSeed = 0x1000;
function nextUuid(): string {
  autoSeed += 1;
  return uuid(autoSeed);
}

type CourseOverrides = Partial<typeof courses.$inferInsert>;

async function insertCourse(
  overrides: CourseOverrides & { slug: string },
): Promise<string> {
  const { slug, ...rest } = overrides;
  const id = rest.id ?? nextUuid();
  await db.insert(courses).values({
    title: `Kursus ${slug}`,
    level: "BEGINNER",
    status: "PUBLISHED",
    createdBy: EDITOR_ID,
    updatedBy: EDITOR_ID,
    ...rest,
    id,
    // Hand-written after the spread, never spreadable over: the slug IS
    // the identity of every assertion here.
    slug,
  });
  return id;
}

type LessonOverrides = Partial<typeof lessons.$inferInsert>;

async function insertLesson(
  courseId: string,
  seed: number,
  overrides: LessonOverrides & { title: string },
): Promise<string> {
  const { title, ...rest } = overrides;
  const id = rest.id ?? uuid(seed);
  await db.insert(lessons).values({
    slug: `materi-${seed}`,
    orderIndex: 1,
    content: EMPTY_DOC,
    ...rest,
    title,
    id,
    // Not spreadable over: the lesson belongs to this course.
    courseId,
  });
  return id;
}

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("../../db/migrations", import.meta.url)),
  });
  db = pgliteDb as unknown as Db;
  dbHolder.current = pgliteDb;

  await db.insert(users).values({
    id: EDITOR_ID,
    name: "Editor Katalog",
    email: "editor-catalog@example.com",
    emailVerified: true,
    role: "EDITOR",
  });
});

afterAll(async () => {
  await pglite.close();
});

describe("getPublicCatalog", () => {
  it("katalog: hanya PUBLISHED dengan materi yang muncul", async () => {
    // All four misses in one test, each with its own data: a DRAFT, an
    // IN_REVIEW, and an ARCHIVED course that DO have lessons, plus a
    // PUBLISHED course WITHOUT lessons.
    const draft = await insertCourse({
      slug: "kat-draft",
      status: "DRAFT",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });
    await insertLesson(draft, 11, { title: "Materi draft" });
    const review = await insertCourse({
      slug: "kat-review",
      status: "IN_REVIEW",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });
    await insertLesson(review, 12, { title: "Materi review" });
    const archived = await insertCourse({
      slug: "kat-arsip",
      status: "ARCHIVED",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });
    await insertLesson(archived, 13, { title: "Materi arsip" });
    await insertCourse({
      slug: "kat-kosong",
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });
    const published = await insertCourse({
      slug: "kat-terbit",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });
    await insertLesson(published, 14, { title: "Materi terbit" });

    const slugs = (await getPublicCatalog()).map((card) => card.slug);
    expect(slugs).toContain("kat-terbit");
    expect(slugs).not.toContain("kat-draft");
    expect(slugs).not.toContain("kat-review");
    expect(slugs).not.toContain("kat-arsip");
    expect(slugs).not.toContain("kat-kosong");
  });

  it("katalog: urutan published_at desc lalu id asc", async () => {
    // Explicit ids AND published_at values so the id order (B, C, A), the
    // insert order (C, A, B), and the expected order (A, B, C) all differ
    // (STATUS 21 Nov lesson 3).
    const oldest = await insertCourse({
      id: uuid(2),
      slug: "urut-lama",
      publishedAt: new Date("2026-11-18T00:00:00Z"),
    });
    const middle = await insertCourse({
      id: uuid(1),
      slug: "urut-tengah",
      publishedAt: new Date("2026-11-19T00:00:00Z"),
    });
    const newest = await insertCourse({
      id: uuid(3),
      slug: "urut-baru",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });
    for (const [courseId, seed] of [
      [oldest, 21],
      [newest, 22],
      [middle, 23],
    ] as const) {
      await insertLesson(courseId, seed, { title: `Materi ${seed}` });
    }

    const slugs = (await getPublicCatalog())
      .filter((card) => card.slug.startsWith("urut-"))
      .map((card) => card.slug);
    expect(slugs).toEqual(["urut-baru", "urut-tengah", "urut-lama"]);
  });

  it("katalog: lessonCount per kursus", async () => {
    const two = await insertCourse({ slug: "hitung-dua" });
    await insertLesson(two, 31, { title: "Materi satu" });
    await insertLesson(two, 32, { title: "Materi dua" });
    const three = await insertCourse({ slug: "hitung-tiga" });
    await insertLesson(three, 33, { title: "Materi satu" });
    await insertLesson(three, 34, { title: "Materi dua" });
    await insertLesson(three, 35, { title: "Materi tiga" });

    const byslug = new Map(
      (await getPublicCatalog()).map((card) => [card.slug, card]),
    );
    expect(byslug.get("hitung-dua")?.lessonCount).toBe(2);
    expect(byslug.get("hitung-tiga")?.lessonCount).toBe(3);
  });

  it("katalog: estimatedMinutes dan summary null/terisi", async () => {
    const filled = await insertCourse({
      slug: "isi-penuh",
      summary: "Ringkasan netral.",
      estimatedMinutes: 42,
    });
    await insertLesson(filled, 41, { title: "Materi satu" });
    const sparse = await insertCourse({ slug: "isi-kosong" });
    await insertLesson(sparse, 42, { title: "Materi satu" });

    const byslug = new Map(
      (await getPublicCatalog()).map((card) => [card.slug, card]),
    );
    expect(byslug.get("isi-penuh")?.summary).toBe("Ringkasan netral.");
    expect(byslug.get("isi-penuh")?.estimatedMinutes).toBe(42);
    expect(byslug.get("isi-kosong")?.summary).toBeNull();
    expect(byslug.get("isi-kosong")?.estimatedMinutes).toBeNull();
    // The card DTO's derived fields ride along.
    expect(byslug.get("isi-penuh")?.levelLabel).toBe("Pemula");
    expect(byslug.get("isi-penuh")?.href).toBe("/kursus/isi-penuh");
  });
});

describe("getPublicCourse", () => {
  it("detail: 404 seragam untuk slug tak ada, DRAFT, ARCHIVED, dan PUBLISHED tanpa materi", async () => {
    const draft = await insertCourse({
      slug: "det-draft",
      status: "DRAFT",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });
    await insertLesson(draft, 51, { title: "Materi draft" });
    const archived = await insertCourse({
      slug: "det-arsip",
      status: "ARCHIVED",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });
    await insertLesson(archived, 52, { title: "Materi arsip" });
    await insertCourse({
      slug: "det-kosong",
      publishedAt: new Date("2026-11-20T00:00:00Z"),
    });

    for (const slug of ["det-draft", "det-arsip", "det-kosong", "det-tak-ada"]) {
      await expect(getPublicCourse(slug), slug).rejects.toThrow(NotFoundError);
    }
    // The SAME error — a draft's existence never leaks.
    const messages = await Promise.allSettled(
      ["det-draft", "det-arsip", "det-kosong", "det-tak-ada"].map((slug) =>
        getPublicCourse(slug),
      ),
    );
    const thrown = messages.flatMap((result) =>
      result.status === "rejected" ? [String(result.reason.message)] : [],
    );
    expect(thrown).toHaveLength(4);
    expect(new Set(thrown).size).toBe(1);
  });

  it("detail: outline urut order_index asc, id asc", async () => {
    const course = await insertCourse({ slug: "det-urut" });
    // order_index dominates: materi 3 has the LOWEST id but the highest
    // order_index; the shared order_index 1 pair is broken by id asc
    // (materi 2 was given the lower id but inserted LAST).
    await insertLesson(course, 63, {
      title: "Materi 3",
      orderIndex: 2,
    });
    await insertLesson(course, 61, {
      title: "Materi 2",
      orderIndex: 1,
    });
    await insertLesson(course, 62, {
      title: "Materi 1",
      orderIndex: 1,
    });

    const dto = await getPublicCourse("det-urut");
    // order_index asc first (materi 3 last despite the LOWEST id), and the
    // shared order_index 1 pair is broken by id asc: "Materi 2" carries the
    // lower id even though it was inserted last.
    expect(dto.lessons.map((lesson) => lesson.title)).toEqual([
      "Materi 2",
      "Materi 1",
      "Materi 3",
    ]);
    expect(dto.lessons.map((lesson) => lesson.position)).toEqual([1, 2, 3]);
    expect(dto.lessonCount).toBe(3);
  });

  it("detail: durationSeconds hanya untuk video READY dengan durasi > 0", async () => {
    const course = await insertCourse({ slug: "det-durasi" });
    // READY rows need a usable source (lessons_video_source_check): a
    // YOUTUBE provider plus an 11-character external id.
    await insertLesson(course, 71, {
      title: "Video siap",
      videoStatus: "READY",
      videoProvider: "YOUTUBE",
      videoExternalId: "aaaaaaaaaa1",
      videoDurationSeconds: 100,
    });
    await insertLesson(course, 72, {
      title: "Tanpa video, durasi terisi",
      videoStatus: "NONE",
      videoDurationSeconds: 200,
    });
    await insertLesson(course, 73, {
      title: "Video siap, durasi nol",
      videoStatus: "READY",
      videoProvider: "YOUTUBE",
      videoExternalId: "aaaaaaaaaa2",
      videoDurationSeconds: 0,
    });

    const dto = await getPublicCourse("det-durasi");
    expect(dto.lessons.map((lesson) => lesson.durationSeconds)).toEqual([
      100,
      null,
      null,
    ]);
  });

  it("detail: hasFinalQuiz dan meta dengan/tanpa seo_title/seo_description", async () => {
    const finalQuizId = uuid(81);
    await db.insert(quizzes).values({
      id: finalQuizId,
      type: "FINAL",
      title: "Final Quiz",
      durationMinutes: 20,
    });
    const withFinal = await insertCourse({
      slug: "det-final",
      finalQuizId,
      seoTitle: "Judul SEO",
      seoDescription: "Deskripsi SEO.",
    });
    await insertLesson(withFinal, 82, { title: "Materi satu" });
    const withoutFinal = await insertCourse({ slug: "det-tanpa-final" });
    await insertLesson(withoutFinal, 83, { title: "Materi satu" });

    const final = await getPublicCourse("det-final");
    expect(final.hasFinalQuiz).toBe(true);
    expect(final.meta).toEqual({
      title: "Judul SEO",
      description: "Deskripsi SEO.",
    });

    const plain = await getPublicCourse("det-tanpa-final");
    expect(plain.hasFinalQuiz).toBe(false);
    expect(plain.meta.title).toBe("Kursus det-tanpa-final");
    expect(plain.meta.description).toBeNull();
  });
});
