// @vitest-environment jsdom
import "./test-env";

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the CSS Module: vitest would otherwise run it through PostCSS
// (the project config is Tailwind-based, unresolvable in the test
// runtime). Tests assert semantics, never class names.
vi.mock("./skeleton.module.css", () => ({
  default: { shimmer: "shimmer" },
}));

import {
  SKELETON_DELAY_MS,
  SkeletonCard,
  SkeletonList,
  SkeletonRow,
  useSkeletonDelay,
} from "./skeleton";

afterEach(() => {
  vi.useRealTimers();
});

function Harness({ active }: { active: boolean }) {
  const visible = useSkeletonDelay(active);
  return visible ? <p>placeholder</p> : null;
}

describe("Skeleton", () => {
  it("renders nothing until the 300ms delay has elapsed", () => {
    vi.useFakeTimers();
    render(<Harness active />);

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 1);
    });
    expect(screen.queryByText("placeholder")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("placeholder")).toBeTruthy();
  });

  it("hides immediately and restarts the delay when loading stops", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness active />);

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });
    expect(screen.getByText("placeholder")).toBeTruthy();

    rerender(<Harness active={false} />);
    expect(screen.queryByText("placeholder")).toBeNull();

    rerender(<Harness active />);
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 1);
    });
    expect(screen.queryByText("placeholder")).toBeNull();
  });

  it("marks the loading area busy with a hidden Memuat text", () => {
    render(
      <SkeletonList>
        <SkeletonCard />
        <SkeletonRow />
      </SkeletonList>,
    );

    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Memuat…")).toBeTruthy();
  });

  it("keeps every placeholder block hidden from assistive tech", () => {
    const { container } = render(
      <div>
        <SkeletonCard />
        <SkeletonRow />
      </div>,
    );
    const blocks = container.querySelectorAll("div[aria-hidden='true']");
    expect(blocks.length).toBeGreaterThan(0);
    expect(
      [...blocks].every((b) => b.getAttribute("aria-hidden") === "true"),
    ).toBe(true);
  });
});
