// @vitest-environment jsdom
import "../ui/test-env";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StartCourseButton } from "./start-course-button";

// Card S5-01 §4: one POST per start, push + HELD loading on 201/200, the
// three error messages with focus returned to the button (owner decision
// 11 Nov no. 3: 404 does NOT router.refresh), and the always-mounted
// C-08 alert whose id joins aria-describedby the moment it has content.

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: refreshMock,
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const COURSE_ID = "1f0c2a34-1111-4111-8111-111111111111";
const START_HREF = "/belajar/gizi-seimbang/materi-pertama";

function jsonResponse(status: number, startHref?: string) {
  return new Response(JSON.stringify({ data: { startHref } }), { status });
}

function renderButton() {
  render(
    <StartCourseButton courseId={COURSE_ID} aria-describedby="judul-kursus">
      Mulai materi 1
    </StartCourseButton>,
  );
  return screen.getByRole("button", { name: "Mulai materi 1" });
}

beforeEach(() => {
  fetchMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
});

describe("StartCourseButton", () => {
  it("POSTs once and pushes to startHref, holding loading (201)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, START_HREF));
    const button = renderButton();
    fireEvent.click(button);

    await waitForFetch();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `/api/progress/courses/${COURSE_ID}/enroll`,
    );
    expect(fetchMock.mock.calls[0]![1]).toEqual({ method: "POST" });
    expect(pushMock).toHaveBeenCalledWith(START_HREF);
    // Loading + guard stay on until the navigation lands.
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("treats 200 (already enrolled) exactly like 201", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, START_HREF));
    const button = renderButton();
    fireEvent.click(button);

    await waitForFetch();
    expect(pushMock).toHaveBeenCalledWith(START_HREF);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("ignores a second click while the first request is in flight", async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const button = renderButton();

    // Both clicks land BEFORE the state commit installs disabled — only
    // the handler guard can catch the second one.
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(jsonResponse(201, START_HREF));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("404 → course-gone message, NO router.refresh, focus back on the button", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404));
    const button = renderButton();
    fireEvent.click(button);

    await waitForFetch();
    expect(
      screen.getByText(
        "Kursus ini tidak lagi tersedia. Muat ulang halaman untuk melihat daftar terbaru.",
      ),
    ).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
  });

  it("401 → session-ended message", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401));
    const button = renderButton();
    fireEvent.click(button);

    await waitForFetch();
    expect(
      screen.getByText(
        "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi.",
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(button);
  });

  it("500 and a network failure → the generic message", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500));
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Mulai materi 1" }));
    await waitForFetch();
    expect(
      screen.getByText(
        "Kursus belum bisa dibuka. Periksa koneksi Anda lalu coba lagi.",
      ),
    ).toBeTruthy();

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const button = screen.getByRole("button", { name: "Mulai materi 1" });
    fireEvent.click(button);
    await waitForFetch();
    expect(
      screen.getByText(
        "Kursus belum bisa dibuka. Periksa koneksi Anda lalu coba lagi.",
      ),
    ).toBeTruthy();
  });

  it("keeps the alert always mounted and joins its id into aria-describedby on error", async () => {
    // Idle: the live region exists but is EMPTY (C-08 — no layout shift, no
    // announcement), and describedby is only the course title.
    const button = renderButton();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("");
    expect(button.getAttribute("aria-describedby")).toBe("judul-kursus");

    fetchMock.mockResolvedValue(jsonResponse(404));
    fireEvent.click(button);
    await waitForFetch();

    const describedBy = button.getAttribute("aria-describedby") ?? "";
    const ids = describedBy.split(/\s+/);
    expect(ids[0]).toBe("judul-kursus");
    expect(ids[1]).toBe(alert.id);
  });
});

/** Waits until the click handler's state settles (error or navigation). */
async function waitForFetch() {
  await act(async () => {
    await Promise.resolve();
  });
}
