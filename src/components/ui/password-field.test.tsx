// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./password-field";

describe("PasswordField", () => {
  it("toggles visibility with the agreed aria labels", () => {
    render(<PasswordField />);
    const eye = screen.getByRole("button", { name: "Tampilkan kata sandi" });
    expect(eye.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(eye);
    const eyeAfter = screen.getByRole("button", {
      name: "Sembunyikan kata sandi",
    });
    expect(eyeAfter.getAttribute("aria-pressed")).toBe("true");
  });

  it("switches the input type along with the toggle", () => {
    render(<PasswordField />);
    const input = screen.getByLabelText("Kata sandi");
    expect(input.getAttribute("type")).toBe("password");
    fireEvent.click(
      screen.getByRole("button", { name: "Tampilkan kata sandi" }),
    );
    expect(input.getAttribute("type")).toBe("text");
  });

  it("shows the three rule pills from screen 3a", () => {
    render(<PasswordField />);
    for (const label of ["8 karakter", "ada huruf", "ada angka"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("announces only when the satisfied count changes", () => {
    render(<PasswordField />);
    const input = screen.getByLabelText("Kata sandi");
    fireEvent.change(input, { target: { value: "a" } });
    expect(screen.getByText("1 dari 3 syarat terpenuhi")).toBeTruthy();
    fireEvent.change(input, { target: { value: "ab" } });
    expect(screen.getByText("1 dari 3 syarat terpenuhi")).toBeTruthy();
    fireEvent.change(input, { target: { value: "ab1" } });
    expect(screen.getByText("2 dari 3 syarat terpenuhi")).toBeTruthy();
  });

  it("locks the input and eye button while loading", () => {
    render(<PasswordField loading />);
    expect(
      (screen.getByLabelText("Kata sandi") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Tampilkan kata sandi",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  // Card C-08 e: the ref must land on the <input> so RHF can focus the
  // field on a validation error.
  it("forwards its ref to the underlying input (React 19 ref-as-prop)", () => {
    let node: HTMLInputElement | null = null;
    render(
      <PasswordField
        ref={(element) => {
          node = element;
        }}
      />,
    );
    expect(node).toBe(screen.getByLabelText("Kata sandi"));
  });
});
