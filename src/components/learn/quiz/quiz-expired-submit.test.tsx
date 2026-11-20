// @vitest-environment jsdom
import "../../ui/test-env";

import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuizExpiredSubmit } from "./quiz-expired-submit";

// Card S3-01 §4.D, retry per S3-02 §2 — the kedaluwarsa beacon: one
// submit POST on mount (StrictMode-safe), then refresh() on 200/409.
// Any other fate shows the inline "Coba lagi" banner; the button
// re-POSTs — the beacon no longer leans on a re-render to retry.

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: refreshMock,
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const ATTEMPT_ID = "0b1f4a67-89ab-4cde-a012-111111111111";
const COLLECT_FAILED_MESSAGE =
  "Jawaban belum terkumpulkan. Periksa koneksi lalu coba lagi.";

function okSubmit(): Response {
  return new Response(JSON.stringify({ data: { status: "EXPIRED" } }), {
    status: 200,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  refreshMock.mockReset();
});

describe("QuizExpiredSubmit", () => {
  it("shows the collecting text", () => {
    fetchMock.mockResolvedValue(okSubmit());
    render(<QuizExpiredSubmit attemptId={ATTEMPT_ID} />);
    expect(
      screen.getByText("Waktu habis — mengumpulkan jawaban…"),
    ).toBeTruthy();
  });

  it("POSTs the submit on mount, then refreshes", async () => {
    fetchMock.mockResolvedValue(okSubmit());
    render(<QuizExpiredSubmit attemptId={ATTEMPT_ID} />);

    await vi.waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`/api/quiz/attempts/${ATTEMPT_ID}/submit`);
    expect(init.method).toBe("POST");
  });

  it("409 (final elsewhere) refreshes without the retry banner", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "conflict" }), { status: 409 }),
    );
    render(<QuizExpiredSubmit attemptId={ATTEMPT_ID} />);

    await vi.waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(COLLECT_FAILED_MESSAGE)).toBeNull();
  });

  it("network failure → retry banner; Coba lagi re-POSTs and refreshes", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okSubmit());
    render(<QuizExpiredSubmit attemptId={ATTEMPT_ID} />);

    await vi.waitFor(() => {
      expect(screen.getByText(COLLECT_FAILED_MESSAGE)).toBeTruthy();
    });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.getByText("Waktu habis.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await vi.waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(COLLECT_FAILED_MESSAGE)).toBeNull();
  });

  it("500 → retry banner too", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );
    render(<QuizExpiredSubmit attemptId={ATTEMPT_ID} />);

    await vi.waitFor(() => {
      expect(screen.getByText(COLLECT_FAILED_MESSAGE)).toBeTruthy();
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("StrictMode double-invokes the effect but the POST fires once", async () => {
    fetchMock.mockResolvedValue(okSubmit());
    render(
      <StrictMode>
        <QuizExpiredSubmit attemptId={ATTEMPT_ID} />
      </StrictMode>,
    );

    await vi.waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
