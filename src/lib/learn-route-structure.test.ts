// Route-structure test (card S5-01 §6): loading.tsx for /belajar must live
// in the `(dashboard)` route GROUP, never directly in belajar/ or (learn)/.
// Verified against a real Next 16.4.1 app (card "Catatan tinjauan 10 Nov"):
// a loading.tsx in belajar/ wraps FUTURE child routes too, so a Kam-12
// lesson page calling notFound() answers 200 (and redirect() answers 200 +
// meta refresh). In (dashboard)/ the fallback covers the dashboard only and
// child routes keep their real statuses. This test fails the day someone
// "tidies" the file into the wrong folder.
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
