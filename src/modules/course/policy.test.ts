// Policy tests (card S1-01 + S1-08 §2): the EDITOR+ gate, checked before
// input parsing, and the submit/publish role rules behind courseActionsFor.
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/lib/errors";

import type { ContentStatus } from "./schema";
import {
  assertCanManageCourses,
  canPublishRole,
  canSubmitRole,
  courseActionsFor,
  type Actor,
} from "./policy";

const actor = (role: Actor["role"]): Actor => ({ id: "u-1", role });

describe("assertCanManageCourses", () => {
  it("rejects MEMBER with 403 ForbiddenError", () => {
    expect(() => assertCanManageCourses(actor("MEMBER"))).toThrow(ForbiddenError);
  });

  it("allows EDITOR, ADMIN, and SUPER_ADMIN", () => {
    expect(() => assertCanManageCourses(actor("EDITOR"))).not.toThrow();
    expect(() => assertCanManageCourses(actor("ADMIN"))).not.toThrow();
    expect(() => assertCanManageCourses(actor("SUPER_ADMIN"))).not.toThrow();
  });
});

describe("canSubmitRole / canPublishRole (card S1-08)", () => {
  it("submits with the EXACT EDITOR role only", () => {
    expect(canSubmitRole("MEMBER")).toBe(false);
    expect(canSubmitRole("EDITOR")).toBe(true);
    expect(canSubmitRole("ADMIN")).toBe(false);
    expect(canSubmitRole("SUPER_ADMIN")).toBe(false);
  });

  it("publishes as ADMIN and above", () => {
    expect(canPublishRole("MEMBER")).toBe(false);
    expect(canPublishRole("EDITOR")).toBe(false);
    expect(canPublishRole("ADMIN")).toBe(true);
    expect(canPublishRole("SUPER_ADMIN")).toBe(true);
  });
});

describe("courseActionsFor", () => {
  const STATUSES: ContentStatus[] = [
    "DRAFT",
    "IN_REVIEW",
    "PUBLISHED",
    "ARCHIVED",
  ];

  it("offers submit only to an EDITOR on a DRAFT course", () => {
    for (const status of STATUSES) {
      expect(courseActionsFor("EDITOR", status).canSubmit).toBe(
        status === "DRAFT",
      );
    }
    for (const role of ["MEMBER", "ADMIN", "SUPER_ADMIN"] as const) {
      expect(courseActionsFor(role, "DRAFT").canSubmit).toBe(false);
    }
  });

  it("offers publish only to ADMIN+ on an IN_REVIEW course", () => {
    for (const status of STATUSES) {
      expect(courseActionsFor("ADMIN", status).canPublish).toBe(
        status === "IN_REVIEW",
      );
    }
    for (const role of ["MEMBER", "EDITOR"] as const) {
      expect(courseActionsFor(role, "IN_REVIEW").canPublish).toBe(false);
    }
    expect(courseActionsFor("SUPER_ADMIN", "IN_REVIEW").canPublish).toBe(true);
  });

  it("never offers submit and publish at once (statuses are disjoint)", () => {
    for (const role of ["MEMBER", "EDITOR", "ADMIN", "SUPER_ADMIN"] as const) {
      for (const status of STATUSES) {
        const actions = courseActionsFor(role, status);
        expect(actions.canSubmit && actions.canPublish).toBe(false);
      }
    }
  });
});
