// Unit tests for the pure CMS nav config (card A-15 steps 1 & 3): table
// order/labels verbatim, active-item resolution, and role labels. The
// role-filtered menu itself is tested in cms-menu.server.test.ts — against
// the real getVisibleCmsMenu, not a copy.
import { describe, expect, it } from "vitest";

import type { UserRole } from "../../lib/rbac";
import {
  CMS_MENU,
  cmsGroupOf,
  getActiveCmsItem,
  roleLabel,
  type CmsMenuItem,
} from "./cms-nav";

const STAFF: UserRole[] = ["EDITOR", "ADMIN", "SUPER_ADMIN"];

function itemById(id: string): CmsMenuItem {
  const item = CMS_MENU.flatMap((group) => group.items).find(
    (candidate) => candidate.id === id,
  );
  if (!item) throw new Error(`unknown item id: ${id}`);
  return item;
}

describe("CMS_MENU — card step 1 table, order and labels verbatim", () => {
  it("lists every group and item in table order", () => {
    expect(
      CMS_MENU.map((group) => ({
        group: group.label ?? "—",
        items: group.items.map((item) => [item.label, item.href]),
      })),
    ).toEqual([
      {
        group: "—",
        items: [["Ringkasan", "/cms"]],
      },
      {
        group: "KONTEN",
        items: [
          ["Artikel", "/cms/artikel"],
          ["Kursus", "/cms/kursus"],
          ["Quiz", "/cms/quiz"],
          ["Media", "/cms/media"],
        ],
      },
      {
        group: "PENGIRIMAN",
        items: [
          ["Menunggu persetujuan", "/cms/konten?status=menunggu"],
          ["Perlu revisi", "/cms/konten?status=perlu-revisi"],
        ],
      },
      {
        group: "PENERBITAN",
        items: [["Persetujuan", "/cms/konten?status=menunggu"]],
      },
      {
        group: "PENGATURAN",
        items: [
          ["Kategori", "/cms/kategori"],
          ["Pengguna & peran", "/cms/pengguna"],
          ["Reset attempt", "/cms/reset-attempt"],
          ["Audit log", "/cms/audit-log"],
          ["Sistem", "/cms/pengaturan"],
        ],
      },
    ]);
  });

  it("gives every item a unique id and an icon", () => {
    const items = CMS_MENU.flatMap((group) => group.items);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const item of items) {
      expect(item.icon, item.id).toBeTruthy();
    }
  });

  it("keeps the authorization path free of the ?status= contract", () => {
    for (const item of CMS_MENU.flatMap((group) => group.items)) {
      expect(item.path, item.id).not.toContain("?");
    }
  });
});

describe("getActiveCmsItem", () => {
  it("marks /cms exact as Ringkasan for every staff role", () => {
    for (const role of STAFF) {
      expect(getActiveCmsItem("/cms", null, role)?.id).toBe("ringkasan");
    }
  });

  it("matches item sub-paths with a segment boundary", () => {
    expect(getActiveCmsItem("/cms/artikel", null, "EDITOR")?.id).toBe(
      "artikel",
    );
    expect(getActiveCmsItem("/cms/artikel/123", null, "EDITOR")?.id).toBe(
      "artikel",
    );
    expect(getActiveCmsItem("/cms/kursus/gizi/materi/2", null, "EDITOR")?.id).toBe(
      "kursus",
    );
    expect(getActiveCmsItem("/cms/quiz/17", null, "EDITOR")?.id).toBe("quiz");
    expect(getActiveCmsItem("/cms/media", null, "ADMIN")?.id).toBe("media");
    expect(getActiveCmsItem("/cms/kategori", null, "ADMIN")?.id).toBe(
      "kategori",
    );
    expect(getActiveCmsItem("/cms/pengguna", null, "ADMIN")?.id).toBe(
      "pengguna",
    );
    expect(getActiveCmsItem("/cms/reset-attempt", null, "SUPER_ADMIN")?.id).toBe(
      "reset-attempt",
    );
    expect(getActiveCmsItem("/cms/audit-log", null, "SUPER_ADMIN")?.id).toBe(
      "audit-log",
    );
    expect(getActiveCmsItem("/cms/pengaturan", null, "SUPER_ADMIN")?.id).toBe(
      "sistem",
    );
  });

  it("does NOT activate on partial segment names", () => {
    expect(getActiveCmsItem("/cms/artikel-lama", null, "EDITOR")).toBeNull();
    expect(getActiveCmsItem("/cms/kursusx", null, "EDITOR")).toBeNull();
  });

  it("resolves /cms/konten by status for EDITOR", () => {
    expect(
      getActiveCmsItem("/cms/konten", "perlu-revisi", "EDITOR")?.id,
    ).toBe("perlu-revisi");
    expect(getActiveCmsItem("/cms/konten", "menunggu", "EDITOR")?.id).toBe(
      "menunggu-persetujuan",
    );
    expect(getActiveCmsItem("/cms/konten", null, "EDITOR")?.id).toBe(
      "menunggu-persetujuan",
    );
    expect(getActiveCmsItem("/cms/konten", "asal", "EDITOR")?.id).toBe(
      "menunggu-persetujuan",
    );
  });

  it("resolves /cms/konten to Persetujuan for ADMIN+ whatever the status", () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
      for (const status of ["menunggu", "perlu-revisi", null, "asal"]) {
        expect(
          getActiveCmsItem("/cms/konten", status, role)?.id,
          `${role} + ${status}`,
        ).toBe("persetujuan");
      }
    }
  });

  it("never returns an item the role cannot see", () => {
    // /cms/konten state items exist only for their roles; guarded pages
    // resolve to null rather than to a hidden item.
    expect(getActiveCmsItem("/cms/konten", "perlu-revisi", "MEMBER")).toBeNull();
    expect(getActiveCmsItem("/cms/kategori", null, "EDITOR")).toBeNull();
    expect(getActiveCmsItem("/cms/audit-log", null, "ADMIN")).toBeNull();
    expect(getActiveCmsItem("/cms", null, "MEMBER")).toBeNull();
    expect(getActiveCmsItem("/cms/rute-tak-dikenal", null, "SUPER_ADMIN")).toBeNull();
  });
});

describe("cmsGroupOf", () => {
  it("finds the owning group for the breadcrumb", () => {
    expect(cmsGroupOf(itemById("artikel"))?.label).toBe("KONTEN");
    expect(cmsGroupOf(itemById("perlu-revisi"))?.label).toBe("PENGIRIMAN");
    expect(cmsGroupOf(itemById("persetujuan"))?.label).toBe("PENERBITAN");
    expect(cmsGroupOf(itemById("sistem"))?.label).toBe("PENGATURAN");
    expect(cmsGroupOf(itemById("ringkasan"))?.label).toBeNull();
  });
});

describe("roleLabel", () => {
  it("maps staff roles to their UI labels (PRD §3.2 v1.4)", () => {
    expect(roleLabel("EDITOR")).toBe("Ahli gizi");
    expect(roleLabel("ADMIN")).toBe("Admin");
    expect(roleLabel("SUPER_ADMIN")).toBe("Super admin");
  });

  it("gives MEMBER no label", () => {
    expect(roleLabel("MEMBER")).toBeNull();
  });
});
