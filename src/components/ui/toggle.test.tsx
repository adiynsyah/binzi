// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Toggle } from "./toggle";

describe("Toggle", () => {
  it("exposes switch semantics and toggles", () => {
    render(<Toggle aria-label="Izinkan notifikasi" />);
    const sw = screen.getByRole("switch", { name: "Izinkan notifikasi" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("can be disabled", () => {
    render(<Toggle aria-label="Izinkan notifikasi" disabled />);
    expect(
      (
        screen.getByRole("switch", {
          name: "Izinkan notifikasi",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
