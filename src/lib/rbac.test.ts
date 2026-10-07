// Unit tests for the A-12 RBAC core (pure — no DB, no Next request scope).
//
// The role × route matrix below is written EXPLICITLY (expected minimum
// roles spelled out per path), so a regression in either ROUTE_RULES or
// the matching logic is caught from both sides (card A-12 "Selesai jika":
// tes matriks role × area).
import { describe, expect, it } from "vitest";

import {
  ALL_ROLES,
  loginRedirectPath,
  minRoleForPath,
  pathAllows,
  roleAtLeast,
  toSessionUser,
  type SessionUser,
  type UserRole,
} from "./rbac";

const RANK: Record<UserRole, number> = {
  MEMBER: 1,
  EDITOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

const GUEST: SessionUser | null = null;
const sessionOf = (role: UserRole): SessionUser => ({
  id: `user-${role.toLowerCase()}`,
  role,
  status: "ACTIVE",
});
const ACTORS: [string, SessionUser | null][] = [
  ["GUEST", GUEST],
  ["MEMBER", sessionOf("MEMBER")],
  ["EDITOR", sessionOf("EDITOR")],
  ["ADMIN", sessionOf("ADMIN")],
  ["SUPER_ADMIN", sessionOf("SUPER_ADMIN")],
];

// Every matrix row (PRD §3.2 + §7.2, owner decision #3) + representative
// sub-paths, with the EXPECTED minimum role written out per entry.
const GUARDED: { path: string; min: UserRole }[] = [
  { path: "/belajar", min: "MEMBER" },
  { path: "/belajar/kursus-saya", min: "MEMBER" },
  { path: "/belajar/gizi-dasar/materi-1/quiz", min: "MEMBER" },
  { path: "/profil", min: "MEMBER" },
  { path: "/cms", min: "EDITOR" },
  { path: "/cms/konten", min: "EDITOR" },
  { path: "/cms/artikel", min: "EDITOR" },
  { path: "/cms/kursus", min: "EDITOR" },
  { path: "/cms/kursus/1/materi/2", min: "EDITOR" },
  { path: "/cms/media", min: "EDITOR" },
  { path: "/cms/kategori", min: "ADMIN" },
  { path: "/cms/pengguna", min: "ADMIN" },
  { path: "/cms/reset-attempt", min: "ADMIN" },
  { path: "/cms/pengaturan", min: "SUPER_ADMIN" },
  { path: "/cms/audit-log", min: "SUPER_ADMIN" },
  // Fail-closed (owner decision adjustment #2): unlisted /cms sub-paths do
  // NOT inherit the EDITOR area minimum.
  { path: "/cms/rute-belum-terdaftar", min: "SUPER_ADMIN" },
  { path: "/cms/", min: "SUPER_ADMIN" },
  { path: "/cms/kursus-baru", min: "SUPER_ADMIN" }, // prefix needs the separator
];

const PUBLIC = [
  "/",
  "/kursus",
  "/artikel/gizi/makan-sehat",
  "/masuk",
  "/api/cms/ping", // API roles live in handlers, not the page matrix
  "/belajar-x", // outside the three guarded areas
];

describe("minRoleForPath", () => {
  it("matches every guarded path to its explicit expected minimum role", () => {
    for (const { path, min } of GUARDED) {
      expect(minRoleForPath(path), path).toBe(min);
    }
  });

  it("returns null for public paths", () => {
    for (const path of PUBLIC) {
      expect(minRoleForPath(path), path).toBeNull();
    }
  });
});

describe("pathAllows — full role × route matrix", () => {
  it("GUEST (null session) is denied every guarded area", () => {
    for (const { path } of GUARDED) {
      expect(pathAllows(GUEST, path), path).toBe(false);
    }
  });

  it("grants a guarded path exactly when the role rank meets the row minimum", () => {
    for (const { path, min } of GUARDED) {
      for (const [name, actor] of ACTORS) {
        if (!actor) continue; // GUEST has its own test above
        const expected = RANK[actor.role] >= RANK[min];
        expect(pathAllows(actor, path), `${name} → ${path}`).toBe(expected);
      }
    }
  });

  it("public paths allow every actor, GUEST included", () => {
    for (const path of PUBLIC) {
      for (const [name, actor] of ACTORS) {
        expect(pathAllows(actor, path), `${name} → ${path}`).toBe(true);
      }
    }
  });
});

describe("roleAtLeast", () => {
  it("is cumulative in the order MEMBER < EDITOR < ADMIN < SUPER_ADMIN", () => {
    expect(ALL_ROLES).toEqual(["MEMBER", "EDITOR", "ADMIN", "SUPER_ADMIN"]);
    for (const role of ALL_ROLES) {
      for (const min of ALL_ROLES) {
        expect(roleAtLeast(role, min)).toBe(RANK[role] >= RANK[min]);
      }
    }
  });
});

describe("loginRedirectPath — forged/missing proxy headers drop `next`", () => {
  it("builds /masuk?next=… from valid proxy headers", () => {
    expect(loginRedirectPath("/cms", null)).toBe("/masuk?next=%2Fcms");
    expect(loginRedirectPath("/cms/pengguna", "?tab=1")).toBe(
      "/masuk?next=%2Fcms%2Fpengguna%3Ftab%3D1",
    );
    expect(loginRedirectPath("/belajar", "")).toBe("/masuk?next=%2Fbelajar");
    // Trimmed before validation (schema contract).
    expect(loginRedirectPath("  /profil  ", null)).toBe(
      "/masuk?next=%2Fprofil",
    );
  });

  it("redirects to plain /masuk when headers are missing", () => {
    expect(loginRedirectPath(null, null)).toBe("/masuk");
    expect(loginRedirectPath("", "")).toBe("/masuk");
  });

  it("treats client-forged header values as untrusted input", () => {
    // Scheme, protocol-relative, backslash, encoded separators, control
    // characters — all rejected by safeInternalRedirectPath, all dropping
    // `next` entirely.
    expect(loginRedirectPath("https://evil.example/phish", "")).toBe("/masuk");
    expect(loginRedirectPath("//evil.example", null)).toBe("/masuk");
    expect(loginRedirectPath("/\\evil.example", null)).toBe("/masuk");
    expect(loginRedirectPath("%2F%2Fevil.example", null)).toBe("/masuk");
    expect(loginRedirectPath("/cms\u0000", null)).toBe("/masuk"); // control char
    expect(loginRedirectPath(null, "?code=1")).toBe("/masuk"); // search alone
    // Oversized value (limit 2048).
    expect(loginRedirectPath(`/${"a".repeat(2048)}`, null)).toBe("/masuk");
  });

  it("keeps an absolute URL inside the SEARCH string — that is data, not a redirect", () => {
    // safeInternalRedirectPath rejects encoded separators only in the path
    // portion; a URL in a query param stays plain data.
    expect(loginRedirectPath("/cms", "?next=https://evil.example")).toBe(
      "/masuk?next=%2Fcms%3Fnext%3Dhttps%3A%2F%2Fevil.example",
    );
  });
});

describe("toSessionUser — fail closed", () => {
  it("returns the user for an ACTIVE session", () => {
    expect(
      toSessionUser({ user: { id: "u1", role: "MEMBER", status: "ACTIVE" } }),
    ).toEqual({ id: "u1", role: "MEMBER", status: "ACTIVE" });
  });

  it("returns null without a session", () => {
    expect(toSessionUser(null)).toBeNull();
  });

  it("collapses SUSPENDED and DELETED to null — same as not signed in", () => {
    expect(
      toSessionUser({ user: { id: "u1", role: "ADMIN", status: "SUSPENDED" } }),
    ).toBeNull();
    expect(
      toSessionUser({ user: { id: "u1", role: "ADMIN", status: "DELETED" } }),
    ).toBeNull();
  });

  it("collapses unknown role/status shapes to null", () => {
    expect(
      toSessionUser({ user: { id: "u1", role: "ROOT", status: "ACTIVE" } }),
    ).toBeNull();
    expect(
      toSessionUser({ user: { id: "u1", role: "MEMBER", status: "BANNED" } }),
    ).toBeNull();
    expect(toSessionUser({ user: { role: "MEMBER", status: "ACTIVE" } })).toBeNull();
    expect(toSessionUser({ user: null })).toBeNull();
  });
});
