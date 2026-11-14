// Gate policy tests (card S2-01 "Selesai jika · Tes policy") — the table,
// row by row, pure functions over outline rows.
import { describe, expect, it } from "vitest";

import {
  assertMemberRole,
  firstOpenUnattempted,
  isLessonUnlocked,
  type LessonGateRow,
} from "./policy";
import type { SessionUser, UserRole } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

/** `quizAttempted` row: null = no lesson_progress row yet. */
function row(quizAttempted: boolean | null): LessonGateRow {
  return { quizAttempted };
}

describe("isLessonUnlocked", () => {
  it("non-sequential course: every position is open", () => {
    const outline = [row(null), row(false), row(true)];
    for (let position = 1; position <= outline.length; position += 1) {
      expect(
        isLessonUnlocked(position, outline, false),
        `position ${position}`,
      ).toBe(true);
    }
  });

  it("sequential: position 1 is open, position 2 stays locked until quiz 1 is attempted", () => {
    const locked = [row(null), row(null)];
    expect(isLessonUnlocked(1, locked, true)).toBe(true);
    expect(isLessonUnlocked(2, locked, true)).toBe(false);

    const attempted = [row(true), row(null)];
    expect(isLessonUnlocked(2, attempted, true)).toBe(true);
  });

  it("sequential: position 3 depends ONLY on the direct predecessor (§11.4 no. 7)", () => {
    // Position 1 unattempted, position 2 attempted → position 3 opens.
    // "All previous lessons" would keep it locked — the card forbids that.
    const outline = [row(false), row(true), row(null)];
    expect(isLessonUnlocked(2, outline, true)).toBe(false);
    expect(isLessonUnlocked(3, outline, true)).toBe(true);
  });
});

describe("firstOpenUnattempted", () => {
  const sequential = (attempted: number): LessonGateRow[] => {
    const rows: LessonGateRow[] = [];
    for (let index = 0; index < 3; index += 1) {
      rows.push(row(index < attempted));
    }
    return rows;
  };

  it("walks with the participant: 0/1/2/3 attempted → 1/2/3/null", () => {
    expect(firstOpenUnattempted(sequential(0), true)).toBe(1);
    expect(firstOpenUnattempted(sequential(1), true)).toBe(2);
    expect(firstOpenUnattempted(sequential(2), true)).toBe(3);
    expect(firstOpenUnattempted(sequential(3), true)).toBeNull();
  });

  it("sends a jumping participant back to the first owed step", () => {
    // Quiz 2 attempted but quiz 1 not: the first open unattempted
    // position is 1, not 3.
    expect(firstOpenUnattempted([row(false), row(true), row(null)], true)).toBe(
      1,
    );
  });

  it("non-sequential: first unattempted lesson, null when all attempted", () => {
    expect(firstOpenUnattempted([row(false), row(false)], false)).toBe(1);
    expect(firstOpenUnattempted([row(true), row(true)], false)).toBeNull();
  });
});

describe("assertMemberRole", () => {
  const member: SessionUser = { id: "u-1", role: "MEMBER", status: "ACTIVE" };

  it("lets MEMBER+ through and fails closed for an unknown rank", () => {
    expect(() => assertMemberRole(member)).not.toThrow();
    expect(() => assertMemberRole({ ...member, role: "EDITOR" })).not.toThrow();
    // MEMBER is the lowest real rank; a role outside the enum must fail
    // closed (same cast proof as the S5-01 integration test).
    expect(() =>
      assertMemberRole({
        ...member,
        role: "GHOST" as UserRole,
      }),
    ).toThrow(ForbiddenError);
  });
});
