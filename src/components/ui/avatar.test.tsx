// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("derives initials from the first two words of the name", () => {
    render(<Avatar name="Rina Kurnia" />);
    expect(screen.getByText("RK")).toBeTruthy();
  });

  it("labels the initials fallback with the full name", () => {
    render(<Avatar name="Rina Kurnia" />);
    expect(
      screen.getByRole("img", { name: "Rina Kurnia" }),
    ).toBeTruthy();
  });

  it("renders a photo with the name as alt text", () => {
    render(<Avatar name="Rina Kurnia" src="/foto.png" />);
    expect(screen.getByAltText("Rina Kurnia")).toBeTruthy();
  });
});
