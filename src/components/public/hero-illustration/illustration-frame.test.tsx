// @vitest-environment jsdom
// Shared jsdom setup (act environment + manual RTL cleanup) — same helper
// the ui/ component tests use.
import "@/components/ui/test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the CSS Module (same reason as skeleton.test.tsx: the Tailwind
// PostCSS config is unresolvable in the test runtime). The illustration
// reads ~40 class names, so the stub echoes any key back verbatim.
vi.mock("./hero-illustration.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => (typeof prop === "string" ? prop : undefined),
    },
  ),
}));

import { IllustrationFrame } from "./illustration-frame";

// Card S6-01 §3 + tambahan 12: the pause control's observable contract is
// (a) the accessible name flips Jeda↔Putar and (b) the wrapper's
// data-paused attaches/detaches — the attribute is what the CSS pause
// selector keys on, so a regression here must turn this file red, not
// just the button-name assertion.
describe("IllustrationFrame", () => {
  it("marks the artwork subtree aria-hidden", () => {
    render(<IllustrationFrame />);
    const stage = document.querySelector("[data-hero-illustration]");
    expect(stage).not.toBeNull();
    expect(stage?.getAttribute("aria-hidden")).toBe("true");
  });

  it("starts unpaused with the button offering to pause", () => {
    render(<IllustrationFrame />);
    const button = screen.getByRole("button", { name: "Jeda animasi" });
    const frame = button.closest("[data-hero-frame]");
    expect(frame?.hasAttribute("data-paused")).toBe(false);
  });

  it("pauses: name flips to Putar animasi and data-paused attaches", () => {
    render(<IllustrationFrame />);
    const button = screen.getByRole("button", { name: "Jeda animasi" });
    fireEvent.click(button);
    const resumed = screen.getByRole("button", { name: "Putar animasi" });
    const frame = resumed.closest("[data-hero-frame]");
    expect(frame?.hasAttribute("data-paused")).toBe(true);
  });

  it("resumes: name flips back and data-paused detaches", () => {
    render(<IllustrationFrame />);
    fireEvent.click(screen.getByRole("button", { name: "Jeda animasi" }));
    fireEvent.click(screen.getByRole("button", { name: "Putar animasi" }));
    const button = screen.getByRole("button", { name: "Jeda animasi" });
    const frame = button.closest("[data-hero-frame]");
    expect(frame?.hasAttribute("data-paused")).toBe(false);
  });
});
