// Per-width expectations (card A-19b §1) — the ONE table every layout spec
// reads, keyed by PROJECT name. playwright.config.ts builds the width
// projects' viewports from it too, so a new width cannot exist in two
// places. Unknown project names THROW (owner decision): never fall back to
// a default or silently skip.
//
// No imports here on purpose: playwright.config.ts loads this module.

export type WidthSpec = {
  /** Project viewport (card table §1). */
  viewport: { width: number; height: number };
  /** Guest header composition (Q41/D-08) — checked via VISIBILITY, the
   * "Cari" link is present at every width and asserted unconditionally. */
  header: {
    bukaMenu: boolean;
    masuk: boolean;
    daftarGratis: boolean;
  };
  /** (learn) bottom nav "Navigasi belajar" (< 768 only). */
  bottomNav: boolean;
  /** CMS navigation shape per width. */
  cms: "bar" | "rail" | "sidebar";
  /** Member account-menu shape per width. */
  account: "drawer" | "dropdown-avatar" | "dropdown-pill";
};

export const WIDTHS = {
  w360: {
    viewport: { width: 360, height: 780 },
    header: { bukaMenu: true, masuk: false, daftarGratis: false },
    bottomNav: true,
    cms: "bar",
    account: "drawer",
  },
  w700: {
    viewport: { width: 700, height: 900 },
    header: { bukaMenu: false, masuk: true, daftarGratis: false },
    bottomNav: true,
    cms: "rail",
    account: "dropdown-avatar",
  },
  w768: {
    viewport: { width: 768, height: 1024 },
    header: { bukaMenu: false, masuk: true, daftarGratis: false },
    bottomNav: false,
    cms: "rail",
    account: "dropdown-avatar",
  },
  w1280: {
    viewport: { width: 1280, height: 800 },
    header: { bukaMenu: false, masuk: true, daftarGratis: true },
    bottomNav: false,
    cms: "sidebar",
    account: "dropdown-pill",
  },
  w1440: {
    viewport: { width: 1440, height: 900 },
    header: { bukaMenu: false, masuk: true, daftarGratis: true },
    bottomNav: false,
    cms: "sidebar",
    account: "dropdown-pill",
  },
} as const satisfies Record<string, WidthSpec>;

/** WidthSpec of a project name — throws for anything not in WIDTHS. */
export function widthSpecOf(projectName: string): WidthSpec {
  const byName = WIDTHS as unknown as Record<string, WidthSpec | undefined>;
  const spec = byName[projectName];
  if (!spec) {
    throw new Error(
      `Unknown project "${projectName}" — expected one of ${Object.keys(WIDTHS)
        .map((name) => `"${name}"`)
        .join(", ")}. Add it to e2e/layout/widths.ts.`,
    );
  }
  return spec;
}
