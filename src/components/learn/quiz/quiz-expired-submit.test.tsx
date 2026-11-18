// @vitest-environment jsdom
import "../../ui/test-env";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuizExpiredSubmit } from "./quiz-expired-submit";

// Card S3-01 §4.D — the kedaluwarsa beacon: one submit POST on mount,
// then router.refresh() regardless of the POST's fate (a failure is
// retried by the refresh re-mounting this component).

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

beforeEach(() => {
  fetchMock.mockReset();
  refreshMock.mockReset();
});

describe("QuizExpiredSubmit", () => {
  it("shows the collecting text", () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { status: "EXPIRED" } }), { status: 200 }),
    );
    render(<QuizExpiredSubmit attemptId={ATTEMPT_ID} />);
    expect(
      screen.getByText("Waktu habis — mengumpulkan jawaban…"),
    ).toBeTruthy();
  });

  it("POSTs the submit on mount, then refreshes", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { status: "EXPIRED" } }), { status: 200 }),
    );
    render(<QuizExpiredSubmit attemptId={ATTEMPT_ID} />);

    await vi.waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`/api/quiz/attempts/${ATTEMPT_ID}/submit`);
    expect(init.method).toBe("POST");
  });

  it("still refreshes when the POST fails — the remount retries it", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<QuizExpiredSubmit attemptId={ATTEMPT_ID} />);

    await vi.waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
