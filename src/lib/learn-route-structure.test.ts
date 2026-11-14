// Route-structure test (cards S5-01 §6 + S2-01 §5): loading.tsx for
// /belajar must live in the `(dashboard)` route GROUP, never directly in
// belajar/ or (learn)/, and NEVER in the material route folders.
// Verified against a real Next 16.4.1 app (cards "Catatan tinjauan" 10–11
// Nov): a loading.tsx in belajar/ (or in [slug]/ / [materi]/) wraps the
// child page's notFound() into a 200 (and redirect() into 200 + meta
// refresh) — with no fallback the answers are the real 200 / 404 / 307.
// The future quiz route /belajar/[slug]/[materi]/quiz sits UNDER [materi]/,
// so its loading.tsx (quiz card) is governed by the same rule. This test
// fails the day someone "tidies" a file into the wrong folder.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(LIB_DIR, "..", "app");

describe("loading.tsx placement for /belajar (card S5-01)", () => {
  it("has no loading.tsx in (learn)/ or belajar/ (would answer 200 for child notFound)", () => {
    expect(existsSync(join(APP_DIR, "(learn)", "loading.tsx"))).toBe(false);
    expect(existsSync(join(APP_DIR, "(learn)", "belajar", "loading.tsx"))).toBe(
      false,
    );
  });

  it("has no page.tsx directly in belajar/ (moved into the route group)", () => {
    expect(existsSync(join(APP_DIR, "(learn)", "belajar", "page.tsx"))).toBe(
      false,
    );
  });

  it("keeps page.tsx and loading.tsx together in belajar/(dashboard)/", () => {
    expect(
      existsSync(join(APP_DIR, "(learn)", "belajar", "(dashboard)", "page.tsx")),
    ).toBe(true);
    expect(
      existsSync(
        join(APP_DIR, "(learn)", "belajar", "(dashboard)", "loading.tsx"),
      ),
    ).toBe(true);
  });
});

describe("material route structure (card S2-01 §5)", () => {
  it("has the lesson page at belajar/[slug]/[materi]/page.tsx", () => {
    expect(
      existsSync(
        join(APP_DIR, "(learn)", "belajar", "[slug]", "[materi]", "page.tsx"),
      ),
    ).toBe(true);
  });

  it("has no loading.tsx under belajar/[slug]/ — 404/307 must stay 404/307", () => {
    // The 11 Nov sandbox check: with loading.tsx in [materi]/ the answers
    // became 200 / 200 / 200; without it they are 200 / 404 / 307.
    expect(
      existsSync(join(APP_DIR, "(learn)", "belajar", "[slug]", "loading.tsx")),
    ).toBe(false);
    expect(
      existsSync(
        join(
          APP_DIR,
          "(learn)",
          "belajar",
          "[slug]",
          "[materi]",
          "loading.tsx",
        ),
      ),
    ).toBe(false);
  });
});
