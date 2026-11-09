// @vitest-environment jsdom
import "@/components/ui/test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TanyaAhliGizi } from "./tanya-ahli-gizi";

// Card S6-01 §8: the WhatsApp control's contract (href → the redirect
// route, new tab, noopener) and the deliberate absence of the email
// fallback (KSL-10 is out of scope for the demo).
describe("TanyaAhliGizi", () => {
  it("points the WhatsApp button at the redirect route in a new tab", () => {
    render(<TanyaAhliGizi />);
    const link = screen.getByRole("link", {
      name: /Chat Ahli Gizi di WhatsApp/,
    });
    expect(link.getAttribute("href")).toBe("/api/konsultasi/whatsapp");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    // The new-tab warning is part of the accessible name (screen readers).
    // Regex, not an exact string: the name is assembled from a text node
    // plus the sr-only span and RTL's exact matcher is stricter about the
    // computed name's whitespace than the DOM text here.
    expect(
      screen.getByRole("link", {
        name: /Chat Ahli Gizi di WhatsApp \(membuka tab baru\)/,
      }),
    ).toBe(link);
  });

  it("links Kenali tim kami to /tentang", () => {
    render(<TanyaAhliGizi />);
    expect(
      screen.getByRole("link", { name: /Kenali tim kami/ }).getAttribute("href"),
    ).toBe("/tentang");
  });

  it("renders no email link (fallback email KSL-10 is out of scope)", () => {
    render(<TanyaAhliGizi />);
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });
});
