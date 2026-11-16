// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createVideoProgressReporter,
  type VideoProgressPayload,
  type VideoProgressSend,
} from "./video-progress-reporter";

// Card S2-02 §5.C rules + the review additions (4a/4b/4c): tick cadence,
// immediate flushes that bypass the one-in-flight guard, ended = duration,
// dedupe, 409 stop, pagehide/dispose keepalive, listener removal, silent
// network errors. Fake timers drive the 10 s cadence; `read` and `send`
// are plain test doubles.

const LESSON_ID = "1f0c2a34-1111-4111-8111-111111111111";

let position = 0;
let duration = 100;
const send = vi.fn<VideoProgressSend>();
// Every reporter ever made in this file — disposed after each test. The
// jsdom window (and `send`) are shared per file: a reporter left listening
// would answer a LATER test's pagehide and inflate its call count.
const reporters: ReturnType<typeof createVideoProgressReporter>[] = [];

function payloadAt(call: number): VideoProgressPayload {
  return send.mock.calls[call]![0];
}

function sendOptionsAt(call: number): { keepalive?: boolean } | undefined {
  return send.mock.calls[call]![1];
}

function ok(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 200 }));
}

function makeReporter() {
  const reporter = createVideoProgressReporter({
    lessonId: LESSON_ID,
    read: () => ({ positionSeconds: position, durationSeconds: duration }),
    send,
  });
  reporters.push(reporter);
  return reporter;
}

function firePageHide(): void {
  window.dispatchEvent(new Event("pagehide"));
}

beforeEach(() => {
  vi.useFakeTimers();
  position = 0;
  duration = 100;
  send.mockReset().mockImplementation(() => ok());
});

afterEach(() => {
  for (const reporter of reporters.splice(0)) {
    reporter.dispose();
  }
  vi.useRealTimers();
});

describe("createVideoProgressReporter — cadence", () => {
  it("ticks at 10 s and 20 s send the position at that moment", async () => {
    const reporter = makeReporter();
    reporter.playing();

    position = 12;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(payloadAt(0)).toEqual({
      lessonId: LESSON_ID,
      positionSeconds: 12,
      durationSeconds: 100,
    });

    position = 25;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(payloadAt(1)!.positionSeconds).toBe(25);
  });

  it("paused() sends immediately and stops the timer", async () => {
    const reporter = makeReporter();
    reporter.playing();

    position = 37;
    reporter.paused();
    expect(send).toHaveBeenCalledTimes(1);
    expect(payloadAt(0)!.positionSeconds).toBe(37);

    position = 50;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(send).toHaveBeenCalledTimes(1); // timer stopped
  });

  it("ended() sends positionSeconds = durationSeconds (→ 100 %)", async () => {
    const reporter = makeReporter();
    reporter.playing();

    position = 63;
    reporter.ended();
    expect(send).toHaveBeenCalledTimes(1);
    expect(payloadAt(0)).toEqual({
      lessonId: LESSON_ID,
      positionSeconds: 100,
      durationSeconds: 100,
    });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(send).toHaveBeenCalledTimes(1); // timer stopped
  });

  it("duration < 1 (unknown) → no request at all", async () => {
    duration = 0;
    const reporter = makeReporter();
    reporter.playing();
    position = 12;
    await vi.advanceTimersByTimeAsync(10_000);
    reporter.paused();
    reporter.ended();
    firePageHide();
    reporter.dispose();
    expect(send).not.toHaveBeenCalled();
  });

  it("position is floored and capped at the duration", async () => {
    const reporter = makeReporter();
    reporter.playing();
    position = 140.9;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(payloadAt(0)!.positionSeconds).toBe(100);
    expect(payloadAt(0)!.durationSeconds).toBe(100);
  });

  it("playing() twice in a row (YT 1 → 3 → 1) keeps ONE timer", async () => {
    const reporter = makeReporter();
    reporter.playing();
    reporter.playing();
    position = 12;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("createVideoProgressReporter — in-flight & dedupe", () => {
  it("a tick arriving while the previous request runs is skipped", async () => {
    let release: ((response: Response) => void) | undefined;
    send.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
    );
    const reporter = makeReporter();
    reporter.playing();

    position = 10;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);

    position = 20;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1); // skipped: still in flight

    release?.(new Response(null, { status: 200 }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(payloadAt(1)!.positionSeconds).toBe(20); // the skipped position re-read at tick time
  });

  it("ended() during an in-flight tick still sends the duration", async () => {
    send.mockImplementation(() => new Promise<Response>(() => {})); // never settles
    const reporter = makeReporter();
    reporter.playing();

    position = 40;
    await vi.advanceTimersByTimeAsync(10_000); // tick 1 in flight forever
    position = 55;
    reporter.ended();
    expect(send).toHaveBeenCalledTimes(2);
    expect(payloadAt(1)).toEqual({
      lessonId: LESSON_ID,
      positionSeconds: 100,
      durationSeconds: 100,
    });
  });

  it("the same position+duration as the last success is not resent", async () => {
    const reporter = makeReporter();
    reporter.playing();

    position = 12;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000); // still 12
    expect(send).toHaveBeenCalledTimes(1);

    position = 13;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("ended() resends even when it equals the last success", async () => {
    const reporter = makeReporter();
    reporter.playing();
    position = 100;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);

    reporter.ended();
    expect(send).toHaveBeenCalledTimes(2);
    expect(payloadAt(1)!.positionSeconds).toBe(100);
  });

  it("409 stops all further sends for this lesson", async () => {
    send.mockImplementationOnce(() =>
      Promise.resolve(new Response(null, { status: 409 })),
    );
    const reporter = makeReporter();
    reporter.playing();

    position = 10;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);

    position = 30;
    await vi.advanceTimersByTimeAsync(10_000); // tick
    reporter.paused();
    reporter.ended();
    firePageHide();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("a network error never throws and the next tick retries", async () => {
    send.mockImplementationOnce(() => Promise.reject(new TypeError("offline")));
    const reporter = makeReporter();
    reporter.playing();

    position = 10;
    await vi.advanceTimersByTimeAsync(10_000);
    position = 20;
    await expect(vi.advanceTimersByTimeAsync(10_000)).resolves.toBeDefined();
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("createVideoProgressReporter — pagehide & dispose", () => {
  it("pagehide while playing sends the last position with keepalive", () => {
    const reporter = makeReporter();
    reporter.playing();
    position = 42;

    firePageHide();
    expect(send).toHaveBeenCalledTimes(1);
    expect(payloadAt(0)!.positionSeconds).toBe(42);
    expect(sendOptionsAt(0)?.keepalive).toBe(true);
  });

  it("pagehide while NOT playing sends nothing", () => {
    makeReporter();
    position = 42;
    firePageHide();
    expect(send).not.toHaveBeenCalled();
  });

  it("dispose() while playing sends with keepalive and stops everything", async () => {
    const reporter = makeReporter();
    reporter.playing();
    position = 42;

    reporter.dispose();
    expect(send).toHaveBeenCalledTimes(1);
    expect(sendOptionsAt(0)?.keepalive).toBe(true);

    position = 60;
    await vi.advanceTimersByTimeAsync(30_000);
    firePageHide();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("dispose() detaches the pagehide listener: a later event sends nothing", () => {
    const reporter = makeReporter();
    reporter.dispose();
    position = 42;
    firePageHide();
    expect(send).not.toHaveBeenCalled();
  });

  it("a normal paused flush does not set keepalive", async () => {
    const reporter = makeReporter();
    reporter.playing();
    position = 42;
    reporter.paused();
    expect(sendOptionsAt(0)?.keepalive).toBeFalsy();
  });
});
