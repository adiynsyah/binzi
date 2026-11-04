// Policy tests (card S1-01): the EDITOR+ gate, checked before input parsing.
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/lib/errors";

import { assertCanManageCourses, type Actor } from "./policy";

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
