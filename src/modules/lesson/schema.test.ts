// Unit tests for the lesson input contract (card S1-02). Pure Zod — no db,
// no server imports — mirroring the course module's schema tests.
import { describe, expect, it } from "vitest";

import { createLessonInput, getLessonInput, LESSON_TITLE_MAX } from "./schema";

describe("createLessonInput", () => {
  it("accepts a title and trims it", () => {
    expect(createLessonInput.parse({ title: "  Makronutrien  " })).toEqual({
      title: "Makronutrien",
    });
  });

  it("rejects an empty/whitespace title with the required message", () => {
    const result = createLessonInput.safeParse({ title: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["title"]);
      expect(result.error.issues[0]?.message).toBe("Judul materi wajib diisi.");
    }
  });

  it("rejects a title over 80 characters", () => {
    const result = createLessonInput.safeParse({ title: "k".repeat(LESSON_TITLE_MAX + 1) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        `Judul materi maksimal ${LESSON_TITLE_MAX} karakter.`,
      );
    }
  });

  it("is strict: unknown keys are rejected, not stripped", () => {
    const result = createLessonInput.safeParse({ title: "Valid", slug: "bocor" });
    expect(result.success).toBe(false);
  });
});

describe("getLessonInput", () => {
  const courseId = "0b9f14b4-1111-4111-8111-111111111111";
  const lessonId = "0b9f14b4-2222-4222-8222-222222222222";

  it("accepts two UUIDs", () => {
    expect(getLessonInput.parse({ courseId, lessonId })).toEqual({ courseId, lessonId });
  });

  it("rejects non-UUID ids and unknown keys", () => {
    expect(getLessonInput.safeParse({ courseId: "bukan-uuid", lessonId }).success).toBe(false);
    expect(getLessonInput.safeParse({ courseId }).success).toBe(false);
    expect(
      getLessonInput.safeParse({ courseId, lessonId, extra: 1 }).success,
    ).toBe(false);
  });
});
