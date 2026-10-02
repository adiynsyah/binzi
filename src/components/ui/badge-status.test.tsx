// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeStatus } from "./badge-status";

describe("BadgeStatus", () => {
  it("renders the five base statuses with the final copy", () => {
    const cases = [
      ["belum-dimulai", "Belum dimulai"],
      ["sedang-berjalan", "Sedang berjalan"],
      ["selesai", "Selesai"],
      ["lulus", "Lulus"],
      ["menunggu-persetujuan", "Menunggu persetujuan"],
    ] as const;
    for (const [status, text] of cases) {
      const { unmount } = render(<BadgeStatus status={status} />);
      expect(screen.getByText(text)).toBeTruthy();
      unmount();
    }
  });

  it("renders the cycle badge with its number", () => {
    render(<BadgeStatus status="siklus" cycle={2} />);
    expect(screen.getByText("Siklus ke-2")).toBeTruthy();
  });

  it("rejects a cycle badge without a number", () => {
    expect(() => render(<BadgeStatus status="siklus" />)).toThrow(
      /requires cycle/,
    );
  });
});
