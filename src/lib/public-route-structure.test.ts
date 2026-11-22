// Route-structure test (card S6-02 §2): the public catalog routes own
// their pages, and NO loading.tsx may appear in (public)/, kursus/, or
// kursus/[slug]/ (card keputusan 12) — the detail page answers notFound()
// and a loading fallback would wrap that 404 into a 200 (same sandbox
// finding as the /belajar routes; see learn-route-structure.test.ts).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(LIB_DIR, "..", "app");

describe("public kursus route structure (card S6-02)", () => {
  it("has the catalog page at (public)/kursus/page.tsx and the detail at (public)/kursus/[slug]/page.tsx", () => {
    expect(existsSync(join(APP_DIR, "(public)", "kursus", "page.tsx"))).toBe(
      true,
    );
    expect(
      existsSync(join(APP_DIR, "(public)", "kursus", "[slug]", "page.tsx")),
    ).toBe(true);
  });

  it("has no loading.tsx in (public)/, kursus/, or kursus/[slug]/ — a 404 must stay 404", () => {
    expect(existsSync(join(APP_DIR, "(public)", "loading.tsx"))).toBe(false);
    expect(
      existsSync(join(APP_DIR, "(public)", "kursus", "loading.tsx")),
    ).toBe(false);
    expect(
      existsSync(join(APP_DIR, "(public)", "kursus", "[slug]", "loading.tsx")),
    ).toBe(false);
  });
});
