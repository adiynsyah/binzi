// @vitest-environment jsdom
import "../ui/test-env";

import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LessonOpenBeacon } from "./lesson-open-beacon";

// Card S2-01 §2.3 + "Selesai jika · Tes komponen": exactly ONE POST per
// lessonId (also under StrictMode's double effect and after a rerender),
// one NEW post when the lessonId changes, and failures never throw —
// reading must not be blocked by the recording.

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const LESSON_ONE = "1f0c2a34-1111-4111-8111-111111111111";
const LESSON_TWO = "1f0c2a34-2222-4222-8222-222222222222";

function ok(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 204 }));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(ok);
});

afterEach(async () => {
  // Let any pending effect promise settle so a swallowed rejection can
  // never leak into the next test as an unhandled rejection.
  await Promise.resolve();
});

describe("LessonOpenBeacon", () => {
  it("renders nothing", () => {
    const { container } = render(<LessonOpenBeacon lessonId={LESSON_ONE} />);
    expect(container.childElementCount).toBe(0);
  });

  it("POSTs exactly once to /api/progress/lessons/{id}/open under StrictMode", async () => {
    render(
      <StrictMode>
        <LessonOpenBeacon lessonId={LESSON_ONE} />
      </StrictMode>,
    );
    await waitForBeacon();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `/api/progress/lessons/${LESSON_ONE}/open`,
    );
    expect(fetchMock.mock.calls[0]![1]).toEqual({ method: "POST" });
  });

  it("does not POST again on a rerender with the same lessonId", async () => {
    const { rerender } = render(<LessonOpenBeacon lessonId={LESSON_ONE} />);
    await waitForBeacon();
    rerender(<LessonOpenBeacon lessonId={LESSON_ONE} />);
    rerender(<LessonOpenBeacon lessonId={LESSON_ONE} />);
    await waitForBeacon();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lessonId change → exactly one NEW post for the new lesson", async () => {
    const { rerender } = render(
      <StrictMode>
        <LessonOpenBeacon lessonId={LESSON_ONE} />
      </StrictMode>,
    );
    await waitForBeacon();
    rerender(
      <StrictMode>
        <LessonOpenBeacon lessonId={LESSON_TWO} />
      </StrictMode>,
    );
    await waitForBeacon();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe(
      `/api/progress/lessons/${LESSON_TWO}/open`,
    );
  });

  it("a rejected fetch (offline) never throws", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    );
    render(<LessonOpenBeacon lessonId={LESSON_ONE} />);
    await waitForBeacon();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a 500 response resolves and is ignored silently", async () => {
    fetchMock.mockImplementation(
      () => Promise.resolve(new Response("boom", { status: 500 })) as never,
    );
    render(<LessonOpenBeacon lessonId={LESSON_ONE} />);
    await waitForBeacon();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/** The POST fires inside useEffect — flush it (and any microtasks). */
async function waitForBeacon(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
