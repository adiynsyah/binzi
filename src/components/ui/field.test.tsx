// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";

describe("Field", () => {
  it("links label, hint and control through ids", () => {
    render(
      <Field label="Email" hint="Gunakan email aktif Anda">
        <Input placeholder="Email Anda" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toBeTruthy();
    expect(input.getAttribute("aria-describedby")).toContain("-hint");
  });

  it("wires an error as aria-invalid + describedby and hides the hint", () => {
    render(
      <Field
        label="Email"
        hint="Gunakan email aktif Anda"
        error="Format email belum lengkap"
      >
        <Input defaultValue="rina.kurnia@" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("-error");
    expect(screen.queryByText("Gunakan email aktif Anda")).toBeNull();
    expect(screen.getByText("Format email belum lengkap")).toBeTruthy();
  });
});
