// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("renders a text input with a placeholder", () => {
    render(<Input placeholder="Email Anda" />);
    expect(screen.getByPlaceholderText("Email Anda")).toBeTruthy();
  });

  it("exposes aria-invalid when flagged", () => {
    render(<Input placeholder="Email Anda" aria-invalid />);
    expect(
      screen.getByPlaceholderText("Email Anda").getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("can be disabled", () => {
    render(<Input placeholder="Email Anda" disabled />);
    expect(
      (screen.getByPlaceholderText("Email Anda") as HTMLInputElement).disabled,
    ).toBe(true);
  });
});
