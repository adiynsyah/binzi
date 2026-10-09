// @vitest-environment jsdom
import "../../ui/test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExpiredResetPanel } from "./expired-link-panel";

// Card A-13 (A-13 visual-fix round): the 3c expired-link panel is the page's
// MAIN heading in the expired state — the (auth) shell renders no h1 there —
// and its button follows 3c's exact metrics (height 46, side padding 18,
// radius 8, 15px/700) instead of relying on a raw buttonVariants() call with
// no size. These tests pin both contracts so the earlier findings (missing
// side padding, section-title-sized card title, white supporting text,
// stacked headings) cannot quietly return.

describe("ExpiredResetPanel", () => {
  it("renders the card title as the page's single h1 (3c 'Judul kartu' scale)", () => {
    render(<ExpiredResetPanel />);
    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    const heading = headings[0]!;
    expect(heading.tagName).toBe("H1");
    expect(heading.textContent).toBe("Tautan ini sudah tidak berlaku");
    // 19/1.3/900 — TOKENS "Judul kartu", NOT the section-title scale.
    expect(heading.className).toContain("text-[19px]");
    expect(heading.className).toContain("font-black");
  });

  it("keeps the supporting copy on ink-surface-text, never white", () => {
    render(<ExpiredResetPanel />);
    const support = screen.getByText(/Tautan reset berlaku 1 jam/);
    expect(support.className).toContain("text-ink-surface-text");
    expect(support.className).not.toContain("text-surface");
  });

  it("links back to /lupa-password with 3c's button metrics", () => {
    render(<ExpiredResetPanel />);
    const link = screen.getByRole("link", { name: "Minta tautan baru" });
    expect(link.getAttribute("href")).toBe("/lupa-password");
    // The regression this round fixed: a raw buttonVariants({ variant })
    // call produced no size at all. The explicit md size + these overrides
    // pin 3c's 46/18/8/15px — and 46 also satisfies the ≥44px touch target.
    // Radius 8 rides a LOCAL --radius-control override (a rounded-[8px]
    // class would lose the stylesheet-order fight with rounded-control).
    for (const pin of [
      "min-h-[46px]",
      "px-[18px]",
      "text-[15px]",
      "[--radius-control:8px]",
    ]) {
      expect(link.className).toContain(pin);
    }
  });
});
