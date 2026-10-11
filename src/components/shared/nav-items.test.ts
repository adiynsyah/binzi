import { describe, expect, it } from "vitest";
import {
  getActiveNavItem,
  NAV_ITEMS,
  PUBLIC_HREFS,
  type NavItemKey,
} from "./nav-items";

const KEY_OF = (pathname: string): NavItemKey | null =>
  getActiveNavItem(pathname)?.key ?? null;

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
