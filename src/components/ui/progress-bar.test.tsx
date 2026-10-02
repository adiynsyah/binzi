// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("exposes progressbar semantics with label and values", () => {
    render(<ProgressBar value={62} label="Progress kursus Gizi Dasar" />);
    const bar = screen.getByRole("progressbar", {
      name: "Progress kursus Gizi Dasar",
    });

    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("62");
  });

  it("clamps values outside the range", () => {
    const { rerender } = render(<ProgressBar value={150} label="Kursus" />);
    expect(
      screen.getByRole("progressbar").getAttribute("aria-valuenow"),
    ).toBe("100");

    rerender(<ProgressBar value={-20} label="Kursus" />);
    expect(
      screen.getByRole("progressbar").getAttribute("aria-valuenow"),
    ).toBe("0");
  });

  it("tracks course progress in success and running activity in primary", () => {
    const { container, rerender } = render(
      <ProgressBar value={50} label="Kursus" tone="success" />,
    );
    const fill = (container.firstChild as HTMLElement).firstElementChild;
    expect(fill?.className).toContain("bg-success");

    rerender(<ProgressBar value={50} label="Kursus" tone="primary" />);
    expect(fill?.className).toContain("bg-primary");
  });

  it("supports custom min/max scales", () => {
    render(<ProgressBar value={3} min={0} max={12} label="Materi ditonton" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemax")).toBe("12");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
  });
});
