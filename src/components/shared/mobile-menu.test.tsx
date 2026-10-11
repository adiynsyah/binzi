// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/*
 * next/navigation is mocked so the menu can be rendered against a
 * controllable pathname; next/link and next/image are swapped for plain
 * elements because they need a running Next runtime.
 */
let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  // React 19 understands `priority` on <img>, so it passes through the
  // spread without warnings.
  default: ({
    src,
    alt,
    ...props
  }: ComponentProps<"img"> & { priority?: boolean; src?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- plain test double
    <img src={typeof src === "string" ? src : ""} alt={alt} {...props} />
  ),
}));

import { MobileMenu } from "./mobile-menu";

function renderMenu(pathname: string) {
  currentPathname = pathname;
  return render(<MobileMenu />);
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Buka menu" }));
  return screen.getByRole("dialog", { name: "Menu" });
}

describe("MobileMenu", () => {
  beforeAll(() => {
    // jsdom has no matchMedia; the menu listens for ≥640px to auto-close.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      })),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens from the ☰ trigger with an accessible name", () => {
    renderMenu("/");
    expect(openMenu()).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Tutup menu" }),
    ).toBeTruthy();
  });

  it("marks the active item via aria-current and the 1d colors", () => {
    renderMenu("/kursus");
    openMenu();

    const active = screen.getByRole("link", { name: "Kursus" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("text-text");
    expect(active.className).not.toContain("text-text-muted");

    const inactive = screen.getByRole("link", { name: "Artikel" });
    expect(inactive.getAttribute("aria-current")).toBeNull();
    expect(inactive.className).toContain("text-text-muted");
  });

  it("keeps Konsultasi unmarked while Beranda stays active on /", () => {
    // usePathname never includes the hash, so viewing /#tanya-ahli-gizi
    // still reports "/" — Beranda carries the current-page mark, never
    // Konsultasi (it is an anchor into the Beranda section).
    renderMenu("/");
    openMenu();

    const konsultasi = screen.getByRole("link", {
      name: "Konsultasi di beranda ↓",
    });
    expect(konsultasi.getAttribute("aria-current")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Beranda" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("closes after an item is clicked", async () => {
    renderMenu("/");
    openMenu();

    fireEvent.click(screen.getByRole("link", { name: "Kursus" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
