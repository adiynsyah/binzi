// Proves the 404-vs-403 split of the user policy (A-08):
// - ownership failures throw NotFoundError (404) so other users' data
//   existence is never confirmed,
// - role failures throw ForbiddenError (403).
import { describe, expect, it } from "vitest";

import { ForbiddenError, NotFoundError } from "../../lib/errors";
import type { Actor } from "./policy";
import {
  PUBLIC_PROFILE_ROLES,
  assertMinRole,
  assertSelf,
  assertSelfOrAdmin,
  hasMinRole,
  isPublicProfileRole,
} from "./policy";

const member: Actor = { id: "usr_member", role: "MEMBER" };
const editor: Actor = { id: "usr_editor", role: "EDITOR" };
const admin: Actor = { id: "usr_admin", role: "ADMIN" };
const superAdmin: Actor = { id: "usr_super", role: "SUPER_ADMIN" };

describe("hasMinRole", () => {
  it("ranks MEMBER < EDITOR < ADMIN < SUPER_ADMIN", () => {
    expect(hasMinRole("MEMBER", "MEMBER")).toBe(true);
    expect(hasMinRole("MEMBER", "EDITOR")).toBe(false);
    expect(hasMinRole("EDITOR", "EDITOR")).toBe(true);
    expect(hasMinRole("EDITOR", "ADMIN")).toBe(false);
    expect(hasMinRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasMinRole("SUPER_ADMIN", "ADMIN")).toBe(true);
  });
});

describe("assertSelf", () => {
  it("passes for the owner", () => {
    expect(() => assertSelf(member, "usr_member")).not.toThrow();
  });

  it("throws 404 (not 403) for anyone else — even admins", () => {
    const attempt = () => assertSelf(admin, "usr_member");
    expect(attempt).toThrow(NotFoundError);
    expect(attempt).toThrow(/Pengguna tidak ditemukan/);
  });
});

describe("assertSelfOrAdmin", () => {
  it("passes for the owner and for ADMIN+", () => {
    expect(() => assertSelfOrAdmin(member, "usr_member")).not.toThrow();
    expect(() => assertSelfOrAdmin(admin, "usr_member")).not.toThrow();
    expect(() => assertSelfOrAdmin(superAdmin, "usr_member")).not.toThrow();
  });

  it("throws 404 for other non-admin actors", () => {
    const attempt = () => assertSelfOrAdmin(editor, "usr_member");
    expect(attempt).toThrow(NotFoundError);
    try {
      attempt();
    } catch (error) {
      expect((error as NotFoundError).status).toBe(404);
    }
  });
});

describe("isPublicProfileRole", () => {
  it("allows EDITOR and above — the byline/reviewer audience", () => {
    expect(isPublicProfileRole("EDITOR")).toBe(true);
    expect(isPublicProfileRole("ADMIN")).toBe(true);
    expect(isPublicProfileRole("SUPER_ADMIN")).toBe(true);
    expect(PUBLIC_PROFILE_ROLES).not.toContain("MEMBER");
  });

  it("keeps MEMBER out of public contexts", () => {
    expect(isPublicProfileRole("MEMBER")).toBe(false);
  });
});

describe("assertMinRole", () => {
  it("passes when the role is sufficient", () => {
    expect(() => assertMinRole(admin, "ADMIN")).not.toThrow();
    expect(() => assertMinRole(superAdmin, "ADMIN")).not.toThrow();
  });

  it("throws 403 with the required role in the message", () => {
    const attempt = () => assertMinRole(member, "ADMIN");
    expect(attempt).toThrow(ForbiddenError);
    try {
      attempt();
    } catch (error) {
      expect((error as ForbiddenError).status).toBe(403);
      expect((error as ForbiddenError).message).toContain("admin");
    }
    expect(() => assertMinRole(editor, "ADMIN")).toThrow(ForbiddenError);
  });
});
