/*
 * Public navigation model (card A-14a) — the single constants file for link
 * targets shared by the guest header, the mobile menu, the footer and the
 * A-14b member header/menu. Pages that do not exist yet legitimately 404
 * until their sprint (S4–S6); no placeholder pages are created for them.
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
  "beranda" | "belajar" | "kursus" | "artikel" | "konsultasi" | "tentang";

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
 * MainNav (header) and MobileMenu — and, through the shared section
 * matching below, by the A-14b member nav.
 */
export function getActiveNavItem(pathname: string): NavItem | null {
  if (pathname === "/") {
    return NAV_ITEMS.find((item) => item.key === "beranda") ?? null;
  }
  return matchPublicSection(pathname);
}

/** Kursus/Artikel/Tentang matching shared by the guest and member nav —
 * first-segment prefixes, "Tentang" exact (single page). */
function matchPublicSection(pathname: string): NavItem | null {
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
 * ===================== Member navigation (card A-14b) =====================
 */

/** MEMBER-area destinations (PRD §7.2 sitemap). */
export const MEMBER_HREFS = {
  belajar: "/belajar",
  kursusSaya: "/belajar/kursus-saya",
  nilai: "/belajar/nilai",
  profil: "/profil",
} as const;

/**
 * The member header nav: identical to the guest nav except "Belajar"
 * replaces "Beranda" (PRD §7.1). Tentang Kami STAYS — the 11 Oct review
 * ruled that the PRD only swaps one item; the design screens that omit
 * Tentang lose to the PRD.
 */
export const MEMBER_NAV_ITEMS: readonly NavItem[] = [
  { key: "belajar", href: MEMBER_HREFS.belajar, label: "Belajar" },
  ...NAV_ITEMS.filter((item) => item.key !== "beranda"),
];

/**
 * Active item for the member header nav (A-14b): Belajar lights up for
 * /belajar/** AND /profil (PRD §7.1); Kursus/Artikel/Tentang behave exactly
 * as in the guest nav. On "/" nothing is current — the member nav has no
 * Beranda item; the logo leads home.
 */
export function getActiveMemberNavItem(pathname: string): NavItem | null {
  if (
    pathname === MEMBER_HREFS.belajar ||
    pathname.startsWith(`${MEMBER_HREFS.belajar}/`) ||
    pathname === MEMBER_HREFS.profil
  ) {
    return MEMBER_NAV_ITEMS.find((item) => item.key === "belajar") ?? null;
  }
  return matchPublicSection(pathname);
}

/** Account-menu rows (13a dropdown / 13d drawer): Dashboard · Kursus Saya ·
 * Nilai Saya · Profil & pengaturan (labels are final copy). */
export type AccountMenuItemKey = "dashboard" | "kursus-saya" | "nilai" | "profil";

export type AccountMenuItem = {
  key: AccountMenuItemKey;
  href: string;
  label: string;
};

export const ACCOUNT_MENU_ITEMS: readonly AccountMenuItem[] = [
  { key: "dashboard", href: MEMBER_HREFS.belajar, label: "Dashboard" },
  { key: "kursus-saya", href: MEMBER_HREFS.kursusSaya, label: "Kursus Saya" },
  { key: "nilai", href: MEMBER_HREFS.nilai, label: "Nilai Saya" },
  {
    key: "profil",
    href: MEMBER_HREFS.profil,
    label: "Profil & pengaturan",
  },
];

/**
 * Active account-menu row: the three specific pages match exactly;
 * Dashboard carries every other /belajar/** path (future player/quiz
 * routes) so exactly one row can be current at most (13d marks "Kursus
 * Saya" on /belajar/kursus-saya).
 */
export function getActiveAccountItem(
  pathname: string,
): AccountMenuItem | null {
  for (const item of ACCOUNT_MENU_ITEMS) {
    if (item.key !== "dashboard" && pathname === item.href) {
      return item;
    }
  }
  if (
    pathname === MEMBER_HREFS.belajar ||
    pathname.startsWith(`${MEMBER_HREFS.belajar}/`)
  ) {
    return ACCOUNT_MENU_ITEMS.find((item) => item.key === "dashboard") ?? null;
  }
  return null;
}

/** Bottom-nav rows for the learn area (8e). */
export type LearnNavItemKey = "materi" | "quiz" | "progress";

export type LearnNavItem = {
  key: LearnNavItemKey;
  href: string;
  label: string;
};

/*
 * sementara — final di S2, isu D-07: the destinations below are temporary
 * stand-ins until the per-course bottom-nav destinations are decided.
 * Matching is EXACT on purpose (card table): other /belajar/** paths and
 * /profil leave the bottom nav without a current item.
 */
export const LEARN_NAV_ITEMS: readonly LearnNavItem[] = [
  { key: "materi", href: MEMBER_HREFS.belajar, label: "Materi" },
  { key: "quiz", href: MEMBER_HREFS.kursusSaya, label: "Quiz" },
  { key: "progress", href: MEMBER_HREFS.nilai, label: "Progress" },
];

export function getActiveLearnNavItem(
  pathname: string,
): LearnNavItem | null {
  return LEARN_NAV_ITEMS.find((item) => item.href === pathname) ?? null;
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
