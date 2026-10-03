// Role semantics tests (AUTH-07 staff = EDITOR/ADMIN/SUPER_ADMIN).
import { describe, expect, it } from "vitest";

import {
  MEMBER_SESSION_SECONDS,
  STAFF_ROLES,
  STAFF_SESSION_SECONDS,
  isStaffRole,
  sessionDurationForRole,
} from "./policy";

describe("isStaffRole", () => {
  it("is false for MEMBER and true for every staff role", () => {
    expect(isStaffRole("MEMBER")).toBe(false);
    for (const role of STAFF_ROLES) {
      expect(isStaffRole(role)).toBe(true);
    }
  });
});

describe("sessionDurationForRole (AUTH-07)", () => {
  it("gives members 30 days", () => {
    expect(MEMBER_SESSION_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(sessionDurationForRole("MEMBER")).toBe(MEMBER_SESSION_SECONDS);
  });

  it("gives every staff role 8 hours", () => {
    expect(STAFF_SESSION_SECONDS).toBe(8 * 60 * 60);
    for (const role of STAFF_ROLES) {
      expect(sessionDurationForRole(role)).toBe(STAFF_SESSION_SECONDS);
    }
  });
});
