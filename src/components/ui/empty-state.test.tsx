// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./empty-state";

const BASE = {
  label: "KONEKSI · KODE 503",
  title: "Daftar kursus belum bisa dimuat",
  description:
    "Biasanya karena sinyal lemah. Progress belajar Anda aman — tidak ada yang hilang.",
  primaryAction: { label: "Coba lagi" },
  alternativeAction: { label: "Baca artikel dulu", href: "/artikel" },
};

describe("EmptyState", () => {
  it("renders the mono label, title and description", () => {
    render(<EmptyState {...BASE} />);
    expect(
      screen.getByText("KONEKSI · KODE 503").className,
    ).toContain("font-mono");
    expect(
      screen.getByText("Daftar kursus belum bisa dimuat"),
    ).toBeTruthy();
    expect(screen.getByText(BASE.description)).toBeTruthy();
  });

  it("always renders BOTH actions — primary button and alternative link", () => {
    render(<EmptyState {...BASE} />);
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();

    const alternative = screen.getByRole("link", {
      name: "Baca artikel dulu",
    });
    expect(alternative.getAttribute("href")).toBe("/artikel");
  });

  it("supports onClick actions on both sides", () => {
    const onRetry = vi.fn();
    const onAlternative = vi.fn();
    render(
      <EmptyState
        {...BASE}
        primaryAction={{ label: "Coba lagi", onClick: onRetry }}
        alternativeAction={{ label: "Baca artikel dulu", onClick: onAlternative }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Baca artikel dulu" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onAlternative).toHaveBeenCalledTimes(1);
  });

  it("renders the alternative as a secondary-styled anchor when href is set", () => {
    render(<EmptyState {...BASE} />);
    const alternative = screen.getByRole("link", {
      name: "Baca artikel dulu",
    });
    // buttonVariants secondary: outlined surface button, no fill.
    expect(alternative.className).toContain("bg-surface");
  });
});
