// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("exposes checkbox semantics and toggles", () => {
    render(<Checkbox aria-label="Setuju dengan ketentuan" />);
    const box = screen.getByRole("checkbox", {
      name: "Setuju dengan ketentuan",
    });
    expect(box.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("can be disabled", () => {
    render(<Checkbox aria-label="Setuju dengan ketentuan" disabled />);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Setuju dengan ketentuan",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
