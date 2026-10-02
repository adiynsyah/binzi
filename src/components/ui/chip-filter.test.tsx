// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChipFilter } from "./chip-filter";

describe("ChipFilter", () => {
  // The accessible name concatenates label and count without the CSS gap
  // ("Semua3"), so match with a tolerant regex.
  it("renders label and count inside the chip", () => {
    render(<ChipFilter label="Semua" count={3} />);
    expect(screen.getByRole("button", { name: /Semua\s*3/ })).toBeTruthy();
  });

  it("reports the active state via aria-pressed", () => {
    render(<ChipFilter label="Sedang berjalan" count={1} active />);
    expect(
      screen
        .getByRole("button", { name: /Sedang berjalan\s*1/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("labels the removable variant as a filter remover and fires onRemove", () => {
    const onRemove = vi.fn();
    render(<ChipFilter label="Sedang berjalan" onRemove={onRemove} />);
    const chip = screen.getByRole("button", {
      name: "Hapus filter Sedang berjalan",
    });
    fireEvent.click(chip);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    render(<ChipFilter label="Semua" count={3} disabled />);
    expect(
      (
        screen.getByRole("button", { name: /Semua\s*3/ }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
