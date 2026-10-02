// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChipFilter } from "./chip-filter";

describe("ChipFilter", () => {
  it("renders label and count separated by · as in the 7a copy", () => {
    render(<ChipFilter label="Semua" count={3} />);
    expect(
      screen.getByRole("button", { name: "Semua · 3" }),
    ).toBeTruthy();
    expect(screen.getByText("·")).toBeTruthy();
  });

  it("reports the active state via aria-pressed", () => {
    render(<ChipFilter label="Sedang berjalan" count={1} active />);
    expect(
      screen
        .getByRole("button", { name: "Sedang berjalan · 1" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("only the ✕ zone removes the filter — the label zone never does", () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(
      <ChipFilter
        label="Sedang berjalan"
        active
        onClick={onClick}
        onRemove={onRemove}
      />,
    );
    // Two separate controls: label zone (toggle) and remove zone (✕).
    const removeZone = screen.getByRole("button", {
      name: "Hapus filter Sedang berjalan",
    });
    const labelZone = screen.getByRole("button", { name: "Sedang berjalan" });
    fireEvent.click(labelZone);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(removeZone);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    render(<ChipFilter label="Semua" count={3} disabled />);
    expect(
      (
        screen.getByRole("button", {
          name: "Semua · 3",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
