// @vitest-environment jsdom
import "@/components/ui/test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the illustration's CSS Module (Tailwind PostCSS config is
// unresolvable in the test runtime — same reason as skeleton.test.tsx).
vi.mock("../hero-illustration/hero-illustration.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => (typeof prop === "string" ? prop : undefined),
    },
  ),
}));

import { PUBLIC_HREFS } from "@/components/shared/nav-items";

import { AHLI_GIZI, STATISTIK_HERO } from "./beranda-content";
import { Hero } from "./hero";

// Card S6-01 §8: CTA hrefs, the highlighted "benar", and the reviewer row
// sourced from beranda-content.ts.
describe("Hero", () => {
  it("links the primary CTA to /daftar and the secondary to /artikel", () => {
    render(<Hero />);
    expect(
      screen.getByRole("link", { name: "Mulai Belajar Gratis" }).getAttribute("href"),
    ).toBe(PUBLIC_HREFS.daftar);
    expect(
      screen.getByRole("link", { name: "Baca Artikel" }).getAttribute("href"),
    ).toBe(PUBLIC_HREFS.artikel);
  });

  it("highlights the word benar with the tint background and deep text", () => {
    render(<Hero />);
    const highlight = screen.getByText("benar");
    expect(highlight.className).toContain("bg-primary-tint");
    expect(highlight.className).toContain("text-primary-deep");
  });

  it("renders the reviewer row from beranda-content.ts", () => {
    render(<Hero />);
    expect(screen.getByText(AHLI_GIZI.nama).tagName).toBe("STRONG");
    // The credential/STR line is a text node inside the same <p> as the
    // name, so match the paragraph and read its full text.
    const reviewer = screen.getByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent?.includes(`STR ${AHLI_GIZI.str}`) === true,
    );
    expect(reviewer.textContent).toContain(AHLI_GIZI.kredensial);
    // The photo is decorative: the name is spelled out next to it.
    expect(screen.getByAltText("")).toBeTruthy();
  });

  // Review 9 Nov: the old <dl> + sr-only <dt> made screen readers announce
  // every label twice. The plain list keeps each label in the DOM exactly
  // once — getAllByText length 1 is the regression guard.
  it("renders each stat label exactly once (no sr-only duplicate)", () => {
    render(<Hero />);
    for (const stat of STATISTIK_HERO) {
      expect(screen.getAllByText(stat.label)).toHaveLength(1);
    }
    expect(screen.getByText(String(STATISTIK_HERO[0].angka))).toBeTruthy();
  });
});
