// videoProgressInput (card S2-01 "Selesai jika · Tes schema") — the
// boundary table, node-only like the serializer tests.
import { describe, expect, it } from "vitest";

import { videoProgressInput } from "./schema";

const LESSON_ID = "3c9d8e2f-1111-4111-8111-111111111111";

function body(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    lessonId: LESSON_ID,
    positionSeconds: 50,
    durationSeconds: 100,
    ...overrides,
  };
}

describe("videoProgressInput", () => {
  it("accepts the boundary values 0 and 86400", () => {
    expect(
      videoProgressInput.parse(
        body({ positionSeconds: 0, durationSeconds: 86400 }),
      ).positionSeconds,
    ).toBe(0);
    expect(
      videoProgressInput.parse(
        body({ positionSeconds: 86400, durationSeconds: 86400 }),
      ).positionSeconds,
    ).toBe(86400);
  });

  it("rejects −1, 86401, 1.5, and a string position", () => {
    for (const positionSeconds of [-1, 86401, 1.5, "50"]) {
      const result = videoProgressInput.safeParse(body({ positionSeconds }));
      expect(result.success, `positionSeconds=${positionSeconds}`).toBe(false);
    }
  });

  it("rejects durationSeconds 0 and 86401", () => {
    for (const durationSeconds of [0, 86401]) {
      const result = videoProgressInput.safeParse(body({ durationSeconds }));
      expect(result.success, `durationSeconds=${durationSeconds}`).toBe(false);
    }
  });

  it("accepts position = duration + 5, rejects + 6 with path positionSeconds", () => {
    expect(
      videoProgressInput.safeParse(
        body({ positionSeconds: 105, durationSeconds: 100 }),
      ).success,
    ).toBe(true);
    const rejected = videoProgressInput.safeParse(
      body({ positionSeconds: 106, durationSeconds: 100 }),
    );
    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(rejected.error.issues[0]?.path).toEqual(["positionSeconds"]);
    }
  });

  it("rejects a non-UUID lessonId but takes the permissive UUID_PATTERN (not z.uuid)", () => {
    expect(
      videoProgressInput.safeParse(body({ lessonId: "bukan-uuid" })).success,
    ).toBe(false);
    // The all-zero UUID has no RFC version nibble — z.uuid() would reject
    // it; the shared pattern keeps /open and /video agreeing on 404s.
    expect(
      videoProgressInput.safeParse(
        body({ lessonId: "00000000-0000-0000-0000-000000000000" }),
      ).success,
    ).toBe(true);
  });

  it("is strict: unknown keys are rejected, not stripped", () => {
    const result = videoProgressInput.safeParse({ ...body(), extra: 1 });
    expect(result.success).toBe(false);
  });
});
