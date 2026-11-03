// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./textarea";

// Same contract as input.test.tsx — Textarea mirrors Input's states (S1-01).

describe("Textarea", () => {
  it("renders a textarea with a placeholder", () => {
    render(<Textarea placeholder="Satu atau dua kalimat" />);
    expect(screen.getByPlaceholderText("Satu atau dua kalimat")).toBeTruthy();
  });

  it("exposes aria-invalid when flagged", () => {
    render(<Textarea placeholder="Satu atau dua kalimat" aria-invalid />);
    expect(
      screen.getByPlaceholderText("Satu atau dua kalimat").getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
  });

  it("can be disabled", () => {
    render(<Textarea placeholder="Satu atau dua kalimat" disabled />);
    expect(
      (screen.getByPlaceholderText("Satu atau dua kalimat") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
  });

  it("accepts ref as a prop (React 19)", () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<Textarea ref={ref} placeholder="Satu atau dua kalimat" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});
