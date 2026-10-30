// Tests for the role-filtered CMS menu (card A-15 step 1). These call the
// REAL getVisibleCmsMenu — the same function the (cms) layout uses — plus
// the real RBAC matrix, so the ✓ columns, pathAllows, and the fail-closed
// guard are all checked against production logic, never a copy.
import { describe, expect, it } from "vitest";

import {
  minRoleForPath,
  pathAllows,
  type SessionUser,
  type UserRole,
} from "@/lib/rbac";
import { CMS_MENU, getActiveCmsItem } from "./cms-nav";
import { getVisibleCmsMenu } from "./cms-menu.server";

type StaffRole = "EDITOR" | "ADMIN" | "SUPER_ADMIN";
const STAFF: StaffRole[] = ["EDITOR", "ADMIN", "SUPER_ADMIN"];

const sessionOf = (role: UserRole): SessionUser => ({
  id: `user-${role.toLowerCase()}`,
  role,
  status: "ACTIVE",
});

/** The card step 1 table: [group label | null, item label] per role. */
const EXPECTED_MENU: Record<StaffRole, [string | null, string][]> = {
  EDITOR: [
    [null, "Ringkasan"],
    ["KONTEN", "Artikel"],
    ["KONTEN", "Kursus"],
    ["KONTEN", "Quiz"],
    ["KONTEN", "Media"],
    ["PENGIRIMAN", "Menunggu persetujuan"],
    ["PENGIRIMAN", "Perlu revisi"],
  ],
  ADMIN: [
    [null, "Ringkasan"],
    ["KONTEN", "Artikel"],
    ["KONTEN", "Kursus"],
    ["KONTEN", "Quiz"],
    ["KONTEN", "Media"],
    ["PENERBITAN", "Persetujuan"],
    ["PENGATURAN", "Kategori"],
    ["PENGATURAN", "Pengguna & peran"],
    ["PENGATURAN", "Reset attempt"],
  ],
  SUPER_ADMIN: [
    [null, "Ringkasan"],
    ["KONTEN", "Artikel"],
    ["KONTEN", "Kursus"],
    ["KONTEN", "Quiz"],
    ["KONTEN", "Media"],
    ["PENERBITAN", "Persetujuan"],
    ["PENGATURAN", "Kategori"],
    ["PENGATURAN", "Pengguna & peran"],
    ["PENGATURAN", "Reset attempt"],
    ["PENGATURAN", "Audit log"],
    ["PENGATURAN", "Sistem"],
  ],
};

describe("getVisibleCmsMenu — exact per-role menus", () => {
  it("matches the card table for every staff role", () => {
    for (const role of STAFF) {
      const rows: [string | null, string][] = getVisibleCmsMenu(
        sessionOf(role),
      ).flatMap((group) =>
        group.items.map(
          (item) => [group.label, item.label] as [string | null, string],
        ),
      );
      expect(rows, role).toEqual(EXPECTED_MENU[role]);
    }
  });

  it("drops groups that have no item for the role", () => {
    // Ahli gizi: no PENERBITAN/PENGATURAN; admin: no PENGIRIMAN.
    expect(
      getVisibleCmsMenu(sessionOf("EDITOR")).map((group) => group.label),
    ).toEqual([null, "KONTEN", "PENGIRIMAN"]);
    expect(
      getVisibleCmsMenu(sessionOf("ADMIN")).map((group) => group.label),
    ).not.toContain("PENGIRIMAN");
  });

  it("shows MEMBER nothing", () => {
    expect(getVisibleCmsMenu(sessionOf("MEMBER"))).toEqual([]);
  });
});

describe("getVisibleCmsMenu — every visible item passes pathAllows", () => {
  it("grants every visible item for every staff role", () => {
    for (const role of STAFF) {
      const user = sessionOf(role);
      for (const group of getVisibleCmsMenu(user)) {
        for (const item of group.items) {
          expect(pathAllows(user, item.path), `${role} → ${item.path}`).toBe(
            true,
          );
        }
      }
    }
  });
});

describe("guard — no menu item falls into the fail-closed catch-all", () => {
  it("keeps minRoleForPath below SUPER_ADMIN except Audit log and Sistem", () => {
    for (const item of CMS_MENU.flatMap((group) => group.items)) {
      const min = minRoleForPath(item.path);
      expect(min, item.path).not.toBeNull();
      if (item.id !== "audit-log" && item.id !== "sistem") {
        expect(min, `${item.label} → ${item.path}`).not.toBe("SUPER_ADMIN");
      }
    }
  });
});

describe("invariant — an active item is always one the role can see", () => {
  const CASES: { pathname: string; status: string | null }[] = [
    { pathname: "/cms", status: null },
    { pathname: "/cms/artikel", status: null },
    { pathname: "/cms/artikel/123", status: null },
    { pathname: "/cms/kursus/gizi", status: null },
    { pathname: "/cms/quiz/17", status: null },
    { pathname: "/cms/media", status: null },
    { pathname: "/cms/konten", status: "menunggu" },
    { pathname: "/cms/konten", status: "perlu-revisi" },
    { pathname: "/cms/konten", status: null },
    { pathname: "/cms/konten", status: "asal" },
    { pathname: "/cms/kategori", status: null },
    { pathname: "/cms/pengguna", status: null },
    { pathname: "/cms/reset-attempt", status: null },
    { pathname: "/cms/audit-log", status: null },
    { pathname: "/cms/pengaturan", status: null },
    { pathname: "/cms/artikel-lama", status: null },
    { pathname: "/cms/kursusx", status: null },
  ];

  it("holds for every case under every staff role", () => {
    for (const role of STAFF) {
      const visibleIds = new Set(
        getVisibleCmsMenu(sessionOf(role)).flatMap((group) =>
          group.items.map((item) => item.id),
        ),
      );
      for (const { pathname, status } of CASES) {
        const active = getActiveCmsItem(pathname, status, role);
        expect(
          active === null || visibleIds.has(active.id),
          `${role} @ ${pathname}?${status ?? ""} → ${active?.id ?? "null"}`,
        ).toBe(true);
      }
    }
  });
});
