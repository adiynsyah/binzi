import { describe, expect, it } from "vitest";
import {
  getActiveAccountItem,
  getActiveLearnNavItem,
  getActiveMemberNavItem,
  getActiveNavItem,
  LEARN_NAV_ITEMS,
  MEMBER_NAV_ITEMS,
  NAV_ITEMS,
  PUBLIC_HREFS,
  type AccountMenuItemKey,
  type LearnNavItemKey,
  type NavItemKey,
} from "./nav-items";

const KEY_OF = (pathname: string): NavItemKey | null =>
  getActiveNavItem(pathname)?.key ?? null;

const MEMBER_KEY_OF = (pathname: string): NavItemKey | null =>
  getActiveMemberNavItem(pathname)?.key ?? null;

const ACCOUNT_KEY_OF = (pathname: string): AccountMenuItemKey | null =>
  getActiveAccountItem(pathname)?.key ?? null;

const LEARN_KEY_OF = (pathname: string): LearnNavItemKey | null =>
  getActiveLearnNavItem(pathname)?.key ?? null;

describe("getActiveNavItem", () => {
  it("marks Beranda only for exactly /", () => {
    expect(KEY_OF("/")).toBe("beranda");
  });

  it("marks Kursus for /kursus and everything below it", () => {
    expect(KEY_OF("/kursus")).toBe("kursus");
    expect(KEY_OF("/kursus/gizi-seimbang")).toBe("kursus");
    expect(KEY_OF("/kursus/a/preview/b")).toBe("kursus");
  });

  it("never matches on a shared prefix alone (/kursus-lain)", () => {
    expect(KEY_OF("/kursus-lain")).toBeNull();
    expect(KEY_OF("/artikelisasi")).toBeNull();
  });

  it("marks Artikel for /artikel and everything below it", () => {
    expect(KEY_OF("/artikel")).toBe("artikel");
    expect(KEY_OF("/artikel/label-kemasan")).toBe("artikel");
    expect(KEY_OF("/artikel/label-kemasan/cara-baca")).toBe("artikel");
  });

  it("marks Tentang for /tentang", () => {
    expect(KEY_OF("/tentang")).toBe("tentang");
  });

  it("stays quiet on pages outside the main nav", () => {
    expect(KEY_OF("/cari")).toBeNull();
    expect(KEY_OF("/masuk")).toBeNull();
    expect(KEY_OF("/daftar")).toBeNull();
    expect(KEY_OF("/kebijakan-privasi")).toBeNull();
    expect(KEY_OF("/belajar/nilai")).toBeNull();
    expect(KEY_OF("/cms")).toBeNull();
  });

  it("never returns Konsultasi — it is an anchor, not a page (§7.1)", () => {
    const pathnames = [
      "/",
      "/#tanya-ahli-gizi", // defensive: hash never reaches usePathname
      "/kursus",
      "/artikel",
      "/tentang",
      "/cari",
      "/tanya-ahli-gizi",
      "",
    ];
    for (const pathname of pathnames) {
      expect(KEY_OF(pathname)).not.toBe("konsultasi");
    }
  });
});

describe("NAV_ITEMS / PUBLIC_HREFS", () => {
  it("exposes exactly the eight A-14a targets", () => {
    expect(new Set(Object.values(PUBLIC_HREFS))).toEqual(
      new Set([
        "/",
        "/kursus",
        "/artikel",
        "/#tanya-ahli-gizi",
        "/tentang",
        "/cari",
        "/masuk",
        "/daftar",
      ]),
    );
  });

  it("links Konsultasi to the Beranda anchor", () => {
    expect(NAV_ITEMS.find((item) => item.key === "konsultasi")?.href).toBe(
      "/#tanya-ahli-gizi",
    );
  });
});

describe("MEMBER_NAV_ITEMS / getActiveMemberNavItem (A-14b)", () => {
  it("is the guest nav with Belajar replacing Beranda", () => {
    expect(MEMBER_NAV_ITEMS.map((item) => item.key)).toEqual([
      "belajar",
      "kursus",
      "artikel",
      "konsultasi",
      "tentang",
    ]);
    expect(MEMBER_NAV_ITEMS.find((i) => i.key === "belajar")?.href).toBe(
      "/belajar",
    );
  });

  it("marks Belajar for /belajar and everything below it, plus /profil", () => {
    expect(MEMBER_KEY_OF("/belajar")).toBe("belajar");
    expect(MEMBER_KEY_OF("/belajar/kursus-saya")).toBe("belajar");
    expect(MEMBER_KEY_OF("/belajar/gizi-seimbang/materi-1")).toBe("belajar");
    expect(MEMBER_KEY_OF("/profil")).toBe("belajar");
  });

  it("marks nothing on / — the member nav has no Beranda item", () => {
    expect(MEMBER_KEY_OF("/")).toBeNull();
  });

  it("keeps the public section rules for Kursus/Artikel/Tentang", () => {
    expect(MEMBER_KEY_OF("/kursus")).toBe("kursus");
    expect(MEMBER_KEY_OF("/artikel/label-kemasan")).toBe("artikel");
    expect(MEMBER_KEY_OF("/tentang")).toBe("tentang");
    expect(MEMBER_KEY_OF("/kursus-lain")).toBeNull();
  });

  it("never returns Konsultasi", () => {
    for (const pathname of ["/", "/belajar", "/kursus", "/tentang", "/cari"]) {
      expect(MEMBER_KEY_OF(pathname)).not.toBe("konsultasi");
    }
  });
});

describe("getActiveAccountItem (dropdown & drawer)", () => {
  it("marks the three specific pages exactly", () => {
    expect(ACCOUNT_KEY_OF("/belajar/kursus-saya")).toBe("kursus-saya");
    expect(ACCOUNT_KEY_OF("/belajar/nilai")).toBe("nilai");
    expect(ACCOUNT_KEY_OF("/profil")).toBe("profil");
  });

  it("marks Dashboard for /belajar itself", () => {
    expect(ACCOUNT_KEY_OF("/belajar")).toBe("dashboard");
  });

  it("gives unclaimed /belajar/** paths to Dashboard (future player routes)", () => {
    expect(ACCOUNT_KEY_OF("/belajar/gizi-seimbang")).toBe("dashboard");
  });

  it("stays quiet outside the member area", () => {
    expect(ACCOUNT_KEY_OF("/")).toBeNull();
    expect(ACCOUNT_KEY_OF("/kursus")).toBeNull();
    expect(ACCOUNT_KEY_OF("/cari")).toBeNull();
    expect(ACCOUNT_KEY_OF("/masuk")).toBeNull();
  });
});

describe("LEARN_NAV_ITEMS / getActiveLearnNavItem (bottom nav)", () => {
  it("uses the temporary destinations (sementara — final di S2, D-07)", () => {
    expect(LEARN_NAV_ITEMS).toEqual([
      { key: "materi", href: "/belajar", label: "Materi" },
      { key: "quiz", href: "/belajar/kursus-saya", label: "Quiz" },
      { key: "progress", href: "/belajar/nilai", label: "Progress" },
    ]);
  });

  it("matches the three destinations exactly", () => {
    expect(LEARN_KEY_OF("/belajar")).toBe("materi");
    expect(LEARN_KEY_OF("/belajar/kursus-saya")).toBe("quiz");
    expect(LEARN_KEY_OF("/belajar/nilai")).toBe("progress");
  });

  it("marks nothing on any other path — exact matching only", () => {
    expect(LEARN_KEY_OF("/belajar/gizi-seimbang")).toBeNull();
    expect(LEARN_KEY_OF("/belajar/kursus-saya/x")).toBeNull();
    expect(LEARN_KEY_OF("/profil")).toBeNull();
    expect(LEARN_KEY_OF("/")).toBeNull();
  });
});
