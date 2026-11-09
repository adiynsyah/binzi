// @vitest-environment jsdom
import "@/components/ui/test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComingSoon } from "./coming-soon";

// Card S6-01 §8: the page name becomes the h1 and both way-out links are
// present on every "Segera hadir" page.
describe("ComingSoon", () => {
  it("renders the page name as h1 with the proposed copy and both links", () => {
    render(<ComingSoon title="Kursus" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Kursus" }),
    ).toBeTruthy();
    expect(screen.getByText("Halaman ini sedang disiapkan.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Kembali ke Beranda" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "Tanya Ahli Gizi" }).getAttribute("href"),
    ).toBe("/#tanya-ahli-gizi");
  });
});
