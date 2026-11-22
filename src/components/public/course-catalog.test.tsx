// @vitest-environment jsdom
import "@/components/ui/test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PublicCourseCardDTO } from "@/modules/course/service";

import { CourseCatalog } from "./course-catalog";

function card(
  overrides: Partial<PublicCourseCardDTO> = {},
): PublicCourseCardDTO {
  return {
    slug: "gizi-seimbang",
    title: "Gizi Seimbang",
    levelLabel: "Pemula",
    summary: "Ringkasan.",
    lessonCount: 2,
    estimatedMinutes: 12,
    href: "/kursus/gizi-seimbang",
    ...overrides,
  };
}

describe("CourseCatalog (card S6-02)", () => {
  it("renders the eyebrow, one h1, and the course-count paragraph", () => {
    render(<CourseCatalog courses={[card(), card({ slug: "mpasi" })]} />);
    expect(screen.getByText("Beranda / Kursus")).toBeTruthy();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Kursus gizi yang ditinjau ahli");
    expect(
      screen.getByText(
        "2 kursus tersedia. Setiap materi singkat dan ditutup satu quiz dengan pembahasan.",
      ),
    ).toBeTruthy();
  });

  it("links each card to its detail and names it via aria-describedby → the h2", () => {
    render(<CourseCatalog courses={[card()]} />);
    const link = screen.getByRole("link", { name: "Lihat kursus" });
    expect(link.getAttribute("href")).toBe("/kursus/gizi-seimbang");
    const describedBy = link.getAttribute("aria-describedby");
    expect(describedBy).toBe("kursus-katalog-gizi-seimbang");
    // The id the link names is the card's h2 (WCAG 2.5.3 for the repeated
    // label).
    expect(document.getElementById(describedBy ?? "")?.tagName).toBe("H2");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Gizi Seimbang",
    );
  });

  it("renders the level · lesson meta, the summary, and the cover meta in lowercase DOM text", () => {
    render(
      <CourseCatalog
        courses={[
          card(),
          card({
            slug: "mpasi",
            summary: null,
            estimatedMinutes: null,
            lessonCount: 3,
            levelLabel: "Menengah",
          }),
        ]}
      />,
    );
    // The level line carries the minutes as sr-only text (PR 153 review
    // item 2): the cover meta rides an aria-hidden CoverBlock, so screen
    // readers would otherwise never hear "12 menit". getByText matches the
    // paragraph's OWN text node; the sr-only span is a separate element.
    const withMinutes = screen.getByText("Pemula · 2 materi");
    expect(
      withMinutes.textContent?.replace(/\s+/g, " ").trim(),
    ).toBe("Pemula · 2 materi · 12 menit");
    expect(withMinutes.querySelector(".sr-only")?.textContent?.trim()).toBe(
      "· 12 menit",
    );
    // No sr-only minutes when estimatedMinutes is null (the "mpasi" card).
    const withoutMinutes = screen.getByText("Menengah · 3 materi");
    expect(withoutMinutes.querySelector(".sr-only")).toBeNull();
    // Cover meta: DOM text lowercase (CSS uppercases) — e2e asserts the
    // same string; " · m menit" only when estimatedMinutes is set.
    expect(screen.getByText("2 materi · 12 menit")).toBeTruthy();
    expect(screen.getByText("3 materi")).toBeTruthy();
    // The summary renders when present, and only then.
    expect(screen.getByText("Ringkasan.")).toBeTruthy();
  });

  it("widens only the last card of an ODD count at 640–1023 (7t)", () => {
    const { container } = render(
      <CourseCatalog courses={[card(), card({ slug: "mpasi" }), card({ slug: "ketiga" })]} />,
    );
    const articles = container.querySelectorAll("article");
    expect(articles).toHaveLength(3);
    expect(articles[2]?.className).toContain("sm:col-span-2");
    expect(articles[0]?.className).not.toContain("sm:col-span-2");
    expect(articles[1]?.className).not.toContain("sm:col-span-2");

    // Even count: no widened card.
    const even = render(
      <CourseCatalog courses={[card(), card({ slug: "mpasi" })]} />,
    ).container.querySelectorAll("article");
    expect(even[0]?.className).not.toContain("sm:col-span-2");
    expect(even[1]?.className).not.toContain("sm:col-span-2");
  });

  it("renders the empty state with the exact LearnDashboard state-C copy and no count paragraph", () => {
    render(<CourseCatalog courses={[]} />);
    expect(screen.queryByText(/kursus tersedia/)).toBeNull();
    expect(screen.getByText("KURSUS · BELUM ADA")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Kursus gizi yang ditinjau ahli",
    );
    expect(screen.getByText("Belum ada kursus yang terbit")).toBeTruthy();
    expect(
      screen.getByText("Kursus pertama sedang disiapkan ahli gizi."),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Tanya Ahli Gizi" }).getAttribute(
        "href",
      ),
    ).toBe("/#tanya-ahli-gizi");
    expect(
      screen.getByRole("link", { name: "Kembali ke Beranda" }).getAttribute(
        "href",
      ),
    ).toBe("/");
  });
});
