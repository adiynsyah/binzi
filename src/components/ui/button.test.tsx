// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders its label as a button", () => {
    render(<Button variant="primary">Mulai quiz</Button>);
    expect(screen.getByRole("button", { name: "Mulai quiz" })).toBeTruthy();
  });

  // Card S1-08 §4: the publish confirm uses the new success variant —
  // assert the exact utility classes so a refactor cannot silently drop
  // the success background/contrast pairing.
  it("applies the success variant classes", () => {
    render(<Button variant="success">Setujui & terbitkan</Button>);
    expect(
      screen.getByRole("button", { name: "Setujui & terbitkan" }).className,
    ).toContain("bg-success");
    expect(
      screen.getByRole("button", { name: "Setujui & terbitkan" }).className,
    ).toContain("text-surface");
  });

  it("locks and reports busy state while loading", () => {
    render(
      <Button loading loadingLabel="Menyimpan…">
        Simpan
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Menyimpan…" });
    expect(button).toBeTruthy();
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("honours the native disabled attribute", () => {
    render(<Button disabled>Hapus akun</Button>);
    expect(
      (
        screen.getByRole("button", { name: "Hapus akun" }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  // Card C-08 a: softDisabled marks the control aria-disabled with the
  // disabled LOOK, but activation is the HANDLER's business — the prop
  // must never block focus or clicks (keyboard users have to reach a
  // Turnstile-gated submit while the challenge is pending).
  it("softDisabled marks aria-disabled yet stays focusable and clickable", () => {
    const onClick = vi.fn();
    render(
      <Button softDisabled onClick={onClick}>
        Masuk
      </Button>,
    );
    const button = screen.getByRole("button", {
      name: "Masuk",
    }) as HTMLButtonElement;
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.disabled).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits aria-disabled when softDisabled is false", () => {
    render(<Button>Masuk</Button>);
    expect(
      screen.getByRole("button", { name: "Masuk" }).getAttribute("aria-disabled"),
    ).toBeNull();
  });

  it("forwards its ref to the button element (React 19 ref-as-prop)", () => {
    let node: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(element) => {
          node = element;
        }}
      >
        Masuk
      </Button>,
    );
    expect(node).toBe(screen.getByRole("button", { name: "Masuk" }));
  });
});
