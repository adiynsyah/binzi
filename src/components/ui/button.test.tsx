// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders its label as a button", () => {
    render(<Button variant="primary">Mulai quiz</Button>);
    expect(screen.getByRole("button", { name: "Mulai quiz" })).toBeTruthy();
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
});
