// @vitest-environment jsdom
import "../ui/test-env";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import { LearnBottomNav } from "./learn-bottom-nav";

function renderNav(pathname: string) {
  currentPathname = pathname;
  return render(<LearnBottomNav />);
}

describe("LearnBottomNav", () => {
  it("exposes the three 8e items in a labelled learn nav (md:hidden)", () => {
    const { container } = renderNav("/belajar");
    const nav = container.querySelector("nav");

    expect(nav?.getAttribute("aria-label")).toBe("Navigasi belajar");
    expect(nav?.className).toContain("md:hidden");
    expect(screen.getByRole("link", { name: "Materi" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quiz" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Progress" })).toBeTruthy();
  });

  it("marks Materi only for exactly /belajar", () => {
    renderNav("/belajar");

    expect(
      screen.getByRole("link", { name: "Materi" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Quiz" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("marks Quiz and Progress on their temporary destinations", () => {
    renderNav("/belajar/kursus-saya");
    expect(
      screen.getByRole("link", { name: "Quiz" }).getAttribute("aria-current"),
    ).toBe("page");

    cleanup();
    renderNav("/belajar/nilai");
    expect(
      screen.getByRole("link", { name: "Progress" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("marks nothing on other /belajar/** paths and /profil (exact only)", () => {
    for (const pathname of ["/belajar/gizi-seimbang", "/profil"]) {
      cleanup();
      renderNav(pathname);
      for (const name of ["Materi", "Quiz", "Progress"]) {
        expect(
          screen.getByRole("link", { name }).getAttribute("aria-current"),
        ).toBeNull();
      }
    }
  });
});
