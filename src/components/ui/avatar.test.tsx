// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("derives ONE initial — the first letter of the name", () => {
    render(<Avatar name="Rina Kurnia" />);
    expect(screen.getByText("R")).toBeTruthy();
  });

  it("trims before taking the initial and uppercases it", () => {
    render(<Avatar name="  dimas arya" />);
    expect(screen.getByText("D")).toBeTruthy();
  });

  it("falls back to ? for a name with no letters", () => {
    render(<Avatar name="   " />);
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("labels the initial fallback with the full name", () => {
    render(<Avatar name="Rina Kurnia" />);
    expect(
      screen.getByRole("img", { name: "Rina Kurnia" }),
    ).toBeTruthy();
  });

  it("becomes decorative with aria-hidden — no role, no label", () => {
    const { container } = render(<Avatar name="Rina Kurnia" aria-hidden="true" />);
    expect(screen.getByText("R")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("span")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("renders a photo with the name as alt text", () => {
    render(<Avatar name="Rina Kurnia" src="/foto.png" />);
    expect(screen.getByAltText("Rina Kurnia")).toBeTruthy();
  });

  it("renders a decorative photo with an empty alt", () => {
    render(<Avatar name="Rina Kurnia" src="/foto.png" aria-hidden="true" />);
    expect(screen.getByAltText("")).toBeTruthy();
  });
});
