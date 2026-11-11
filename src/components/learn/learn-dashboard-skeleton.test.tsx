// @vitest-environment jsdom
import "../ui/test-env";

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the CSS Module (same reason as ui/skeleton.test.tsx).
vi.mock("../ui/skeleton.module.css", () => ({
  default: { shimmer: "shimmer" },
}));

import { SKELETON_DELAY_MS } from "../ui/skeleton";
import { LearnDashboardSkeleton } from "./learn-dashboard-skeleton";

// Card S5-01 §2: nothing before SKELETON_DELAY_MS (a fast navigation skips
// the flicker), then the role="status" region announcing "Memuat…" in the
// 28a shape.
afterEach(() => {
  vi.useRealTimers();
});

describe("LearnDashboardSkeleton", () => {
  it("renders nothing before 300ms, then the loading region", () => {
    vi.useFakeTimers();
    const { container } = render(<LearnDashboardSkeleton />);

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 1);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Memuat…")).toBeTruthy();
  });
});
