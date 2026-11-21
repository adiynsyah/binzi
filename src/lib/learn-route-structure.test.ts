// Route-structure test (cards S5-01 §6 + S2-01 §5 + S3-01 §5): loading.tsx
// for /belajar must live in the `(dashboard)` route GROUP, never directly
// in belajar/ or (learn)/, and NEVER in the material route folders.
// Verified against a real Next 16.4.1 app (cards "Catatan tinjauan" 10–11
// Nov): a loading.tsx in belajar/ (or in [slug]/ / [materi]/) wraps the
// child page's notFound() into a 200 (and redirect() into 200 + meta
// refresh) — with no fallback the answers are the real 200 / 404 / 307.
// The quiz route /belajar/[slug]/[materi]/quiz sits UNDER [materi]/, so
// its loading.tsx (quiz card §5) is governed by the same rule — the
// kedaluwarsa beacon's router.refresh() must not flash a fallback between
// the expired screen and the result. This test fails the day someone
// "tidies" a file into the wrong folder.
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

describe("quiz route structure (card S3-01 §5)", () => {
  it("has the quiz page at belajar/[slug]/[materi]/quiz/page.tsx", () => {
    expect(
      existsSync(
        join(
          APP_DIR,
          "(learn)",
          "belajar",
          "[slug]",
          "[materi]",
          "quiz",
          "page.tsx",
        ),
      ),
    ).toBe(true);
  });

  it("has no loading.tsx in [materi]/quiz/ — no fallback before hasil", () => {
    // The kedaluwarsa beacon POSTs then refreshes; a loading fallback here
    // would answer 200 between the expired screen and the result render.
    expect(
      existsSync(
        join(
          APP_DIR,
          "(learn)",
          "belajar",
          "[slug]",
          "[materi]",
          "quiz",
          "loading.tsx",
        ),
      ),
    ).toBe(false);
  });
});

describe("final quiz route structure (card S5-02 §6)", () => {
  it("has the Final Quiz page at belajar/[slug]/final-quiz/page.tsx", () => {
    // The static segment `final-quiz` wins over [materi]; the lesson slug
    // "final-quiz" itself is rejected in lesson/queries.ts.
    expect(
      existsSync(
        join(APP_DIR, "(learn)", "belajar", "[slug]", "final-quiz", "page.tsx"),
      ),
    ).toBe(true);
  });

  it("has no loading.tsx in [slug]/final-quiz/ — 404/307 must stay 404/307", () => {
    // Same S2-01 sandbox finding as [materi]/quiz: with a fallback,
    // notFound() answers 200 and the `kembali` redirect answers 200 with a
    // meta refresh instead of a 307.
    expect(
      existsSync(
        join(
          APP_DIR,
          "(learn)",
          "belajar",
          "[slug]",
          "final-quiz",
          "loading.tsx",
        ),
      ),
    ).toBe(false);
  });
});

describe("nilai route structure (card S5-03 §3)", () => {
  it("has the Nilai Saya page at belajar/nilai/page.tsx", () => {
    // The static segment `nilai` wins over [slug]; a course slug "nilai"
    // is rejected in course/schema.ts (checked since S1-01).
    expect(
      existsSync(join(APP_DIR, "(learn)", "belajar", "nilai", "page.tsx")),
    ).toBe(true);
  });

  it("has no loading.tsx in belajar/nilai/ — outside (dashboard), nothing to fall back to", () => {
    // Card §3: the dashboard skeleton is not this page's shape, and one
    // pure GET needs no fallback. Guarded so a later addition has to
    // revisit the decision.
    expect(
      existsSync(join(APP_DIR, "(learn)", "belajar", "nilai", "loading.tsx")),
    ).toBe(false);
  });
});

describe("kursus-saya + progres route structure (card S5-04 §2)", () => {
  it("has Kursus Saya at belajar/kursus-saya/page.tsx and the progress page at belajar/[slug]/page.tsx", () => {
    // The static segment `kursus-saya` wins over [slug]; that course slug
    // is rejected by the CMS schema like "nilai".
    expect(
      existsSync(
        join(APP_DIR, "(learn)", "belajar", "kursus-saya", "page.tsx"),
      ),
    ).toBe(true);
    expect(
      existsSync(join(APP_DIR, "(learn)", "belajar", "[slug]", "page.tsx")),
    ).toBe(true);
  });

  it("has no loading.tsx in belajar/kursus-saya/ or [slug]/ — 404/307 must stay 404/307", () => {
    // Same rule as [materi]/ and final-quiz/: the progress page answers
    // notFound()/redirect(), and a fallback would wrap both into 200s.
    expect(
      existsSync(
        join(APP_DIR, "(learn)", "belajar", "kursus-saya", "loading.tsx"),
      ),
    ).toBe(false);
    expect(
      existsSync(join(APP_DIR, "(learn)", "belajar", "[slug]", "loading.tsx")),
    ).toBe(false);
  });
});
