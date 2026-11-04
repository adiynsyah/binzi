// Unit tests for the 23505 → field-error mapping helpers (card S1-01).
// Fake driver errors are wrapped in a REAL DrizzleQueryError — drizzle-orm
// 0.45 keeps the driver error on `cause` — in both driver shapes: postgres.js
// (`constraint_name`) and PGlite (`constraint`).
import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";

import { isUniqueViolation } from "./db-errors";

const CONSTRAINT = "courses_slug_unique";

function wrapped(cause: Record<string, unknown>): DrizzleQueryError {
  return new DrizzleQueryError("insert into courses", [], cause as unknown as Error);
}

describe("isUniqueViolation", () => {
  it("recognizes the postgres.js shape (constraint_name) in cause", () => {
    const error = wrapped({
      code: "23505",
      constraint_name: CONSTRAINT,
    });
    expect(isUniqueViolation(error, CONSTRAINT)).toBe(true);
  });

  it("recognizes the PGlite shape (constraint) in cause", () => {
    const error = wrapped({
      code: "23505",
      constraint: CONSTRAINT,
    });
    expect(isUniqueViolation(error, CONSTRAINT)).toBe(true);
  });

  it("recognizes an unwrapped driver error", () => {
    expect(
      isUniqueViolation(
        { code: "23505", constraint_name: CONSTRAINT },
        CONSTRAINT,
      ),
    ).toBe(true);
  });

  it("does not claim a different constraint's 23505", () => {
    const error = wrapped({
      code: "23505",
      constraint: "courses_pkey",
    });
    expect(isUniqueViolation(error, CONSTRAINT)).toBe(false);
  });

  it("does not claim other error codes or missing fields", () => {
    expect(isUniqueViolation(wrapped({ code: "23503", constraint: CONSTRAINT }), CONSTRAINT)).toBe(false);
    expect(isUniqueViolation(wrapped({ code: "23505" }), CONSTRAINT)).toBe(false);
    expect(isUniqueViolation(new Error("bukan db"), CONSTRAINT)).toBe(false);
    expect(isUniqueViolation(null, CONSTRAINT)).toBe(false);
  });
});
