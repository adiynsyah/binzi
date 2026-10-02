// @vitest-environment jsdom
import "./test-env";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BANNER_AUTO_DISMISS_MS, Banner } from "./banner";

afterEach(() => {
  vi.useRealTimers();
});

describe("Banner", () => {
  it("renders error banners assertively and success politely", () => {
    const { unmount } = render(<Banner tone="error" title="Gagal menyimpan" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    unmount();

    render(<Banner tone="success" title="Tersimpan" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("auto-dismisses a success banner after 4s and reports it", () => {
    vi.useFakeTimers();
    const onDismissed = vi.fn();
    render(
      <Banner tone="success" title="Tersimpan" onDismissed={onDismissed} />,
    );

    act(() => {
      vi.advanceTimersByTime(BANNER_AUTO_DISMISS_MS - 1);
    });
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it("keeps info and error banners until unmounted", () => {
    vi.useFakeTimers();
    render(<Banner tone="info" title="Draf disimpan otomatis" />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("pauses the countdown while hovered, then resumes the remainder", () => {
    vi.useFakeTimers();
    render(<Banner tone="success" title="Tersimpan" />);
    const banner = screen.getByRole("status");

    fireEvent.mouseEnter(banner);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("status")).toBeTruthy();

    fireEvent.mouseLeave(banner);
    act(() => {
      vi.advanceTimersByTime(BANNER_AUTO_DISMISS_MS - 1);
    });
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("pauses the countdown while its action is focused", () => {
    vi.useFakeTimers();
    render(
      <Banner
        tone="success"
        title="Tersimpan"
        action={<button type="button">Kirim ulang</button>}
      />,
    );
    const action = screen.getByRole("button", { name: "Kirim ulang" });

    // jsdom's HTMLElement.focus() dispatches the bubbling focusin event
    // the banner listens for via onFocusCapture.
    act(() => {
      action.focus();
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => {
      action.blur();
    });
    act(() => {
      vi.advanceTimersByTime(BANNER_AUTO_DISMISS_MS);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
