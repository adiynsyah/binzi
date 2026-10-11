/*
 * Public navigation model (card A-14a) — the single constants file for link
 * targets shared by the guest header, the mobile menu, the footer and later
 * A-14b (member header). Pages that do not exist yet legitimately 404 until
 * their sprint (S4–S6); no placeholder pages are created for them.
 */

/** The eight public targets listed on card A-14a. */
export const PUBLIC_HREFS = {
  home: "/",
  kursus: "/kursus",
  artikel: "/artikel",
  konsultasi: "/#tanya-ahli-gizi",
  tentang: "/tentang",
  cari: "/cari",
  masuk: "/masuk",
  daftar: "/daftar",
} as const;

export type NavItemKey =
  "beranda" | "kursus" | "artikel" | "konsultasi" | "tentang";

export type NavItem = {
  key: NavItemKey;
  href: string;
  label: string;
  /** Compact label for the 640–1023px header (1t): "Tentang". */
  shortLabel?: string;
};

/** The five main-nav items (PRD §7.1). */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "beranda", href: PUBLIC_HREFS.home, label: "Beranda" },
  { key: "kursus", href: PUBLIC_HREFS.kursus, label: "Kursus" },
  { key: "artikel", href: PUBLIC_HREFS.artikel, label: "Artikel" },
  {
    key: "konsultasi",
    href: PUBLIC_HREFS.konsultasi,
    label: "Konsultasi",
  },
  {
    key: "tentang",
    href: PUBLIC_HREFS.tentang,
    label: "Tentang Kami",
    shortLabel: "Tentang",
  },
];

/*
 * Resolves the nav item that carries aria-current="page" for a pathname
 * (PRD §7.1):
 * - Beranda only for exactly "/" — never for other sections of the home page;
 * - Kursus for /kursus/** and Artikel for /artikel/** via FIRST-SEGMENT
 *   matching, so "/kursus-lain" does not light up "Kursus";
 * - Tentang for "/tentang";
 * - Konsultasi is NEVER active — it is an anchor into the Beranda, not a
 *   page, so "Beranda" stays the active item there.
 *
 * Pure on purpose: unit-tested in nav-items.test.ts, consumed by both
 * MainNav (header) and MobileMenu.
 */
export function getActiveNavItem(pathname: string): NavItem | null {
  if (pathname === "/") {
    return NAV_ITEMS.find((item) => item.key === "beranda") ?? null;
  }
  const firstSegment = pathname.split("/")[1] ?? "";
  if (firstSegment === "kursus") {
    return NAV_ITEMS.find((item) => item.key === "kursus") ?? null;
  }
  if (firstSegment === "artikel") {
    return NAV_ITEMS.find((item) => item.key === "artikel") ?? null;
  }
  if (pathname === "/tentang") {
    return NAV_ITEMS.find((item) => item.key === "tentang") ?? null;
  }
  return null;
}

/*
 * Rendered header height per breakpoint (68 = 44px controls + 2×12 padding
 * below 640px; 80 = 44px controls + 2×18 padding from 640px up, per 1a/1t).
 * S6 consumes the numbers for the Tanya Ahli Gizi section's scroll-margin-top
 * (KSL-14); site-header/mobile-menu consume the class string so the dialog's
 * cover row always matches the bar it replaces. Keep the literals in sync.
 */
export const HEADER_HEIGHT = {
  mobile: 68,
  tablet: 80,
  desktop: 80,
} as const;

export const HEADER_HEIGHT_CLASS = "h-[68px] sm:h-[80px]";
