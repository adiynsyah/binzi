import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import {
  createAnswerSaveQueue,
  type SaveAnswerSend,
} from "./answer-save-queue";

// Card S3-01 §4.B — the save queue table, tested like the S2-02 reporter:
// injected `send`, fake timers for the 1/2/5/5 s backoff. requestAt()
// inspects the (attemptId, questionId, optionId) each PUT carried.

const ATTEMPT_ID = "0b1f4a67-89ab-4cde-a012-111111111111";
const Q1 = "11111111-2222-4333-8444-555555555555";
const Q2 = "11111111-2222-4333-8444-666666666666";
const OPTION_A = "aaaaaaaa-2222-4333-8444-555555555555";
const OPTION_B = "bbbbbbbb-2222-4333-8444-555555555555";

let sendMock: Mock<SaveAnswerSend>;

function ok(): Response {
  return new Response(JSON.stringify({ data: { savedAt: "2026-11-18T00:00:00.000Z" } }), { status: 200 });
}

function status(status: number): Response {
  return new Response(JSON.stringify({ error: { message: "x" } }), { status });
}

function createQueue(config?: {
  onFinalized?: () => void;
  onGone?: () => void;
}) {
  return createAnswerSaveQueue({
    attemptId: ATTEMPT_ID,
    send: sendMock,
    ...config,
  });
}

/** The request payload of the nth send call (1-based). */
function requestAt(index: number) {
  return sendMock.mock.calls[index - 1]![0] as {
    attemptId: string;
    questionId: string;
    optionId: string;
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  sendMock = vi.fn<SaveAnswerSend>();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAnswerSaveQueue", () => {
  it("sends one PUT per pick and confirms the state", async () => {
    sendMock.mockResolvedValue(ok());
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(requestAt(1)).toEqual({
      attemptId: ATTEMPT_ID,
      questionId: Q1,
      optionId: OPTION_A,
    });

    await vi.runOnlyPendingTimersAsync();
    expect(queue.getState()).toEqual({
      pending: [],
      saving: false,
      failingSince: null,
      recovered: null,
    });
  });

  it("re-sends when a newer pick lands while the older request is in flight", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    sendMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    queue.setAnswer(Q1, OPTION_B); // mid-flight change of mind
    expect(sendMock).toHaveBeenCalledTimes(1); // older request still running

    await vi.advanceTimersByTimeAsync(0);
    resolvers[0]!(ok());
    await vi.advanceTimersByTimeAsync(0);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(requestAt(2).optionId).toBe(OPTION_B);

    resolvers[1]!(ok());
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.getState().pending).toEqual([]);
  });

  it("does not re-send a re-pick of the already-confirmed option", async () => {
    sendMock.mockResolvedValue(ok());
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    await vi.runOnlyPendingTimersAsync();
    queue.setAnswer(Q1, OPTION_A);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure after 1, 2, 5, then every 5 seconds", async () => {
    sendMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    await vi.advanceTimersByTimeAsync(0);
    const failingSince = queue.getState().failingSince;
    expect(failingSince).toBe(Date.now());

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sendMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sendMock).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sendMock).toHaveBeenCalledTimes(5);

    const state = queue.getState();
    expect(state.pending).toEqual([Q1]);
    expect(state.saving).toBe(false);
    expect(state.failingSince).toBe(failingSince);
  });

  it("retries a 5xx on the same schedule", async () => {
    sendMock.mockResolvedValue(status(503));
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    await vi.advanceTimersByTimeAsync(0);
    expect(sendMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(queue.getState().failingSince).not.toBeNull();
  });

  it("409 → stops and hands over to onFinalized (collect + refresh)", async () => {
    sendMock.mockResolvedValue(status(409));
    const onFinalized = vi.fn();
    const queue = createQueue({ onFinalized });

    queue.setAnswer(Q1, OPTION_A);
    await vi.advanceTimersByTimeAsync(0);
    expect(onFinalized).toHaveBeenCalledTimes(1);

    queue.setAnswer(Q2, OPTION_A); // stopped: no new request
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("404 (and other definitive non-5xx) → stops and hands over to onGone", async () => {
    sendMock.mockResolvedValue(status(404));
    const onGone = vi.fn();
    const queue = createQueue({ onGone });

    queue.setAnswer(Q1, OPTION_A);
    await vi.advanceTimersByTimeAsync(0);
    expect(onGone).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("retryNow sends every pending question immediately, clearing the backoff", async () => {
    let fail = true;
    sendMock.mockImplementation(async () => {
      if (fail) throw new TypeError("Failed to fetch");
      return ok();
    });
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    queue.setAnswer(Q2, OPTION_B);
    await vi.advanceTimersByTimeAsync(0); // both fail
    expect(sendMock).toHaveBeenCalledTimes(2);

    fail = false;
    queue.retryNow(); // before the 1 s backoff fires
    await vi.advanceTimersByTimeAsync(0);
    expect(sendMock).toHaveBeenCalledTimes(4);
    expect(queue.getState().pending).toEqual([]);
  });

  it("flush resolves once everything is confirmed", async () => {
    let resolveFirst!: (response: Response) => void;
    sendMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    await vi.advanceTimersByTimeAsync(0);
    let flushed = false;
    void queue.flush(5_000).then(() => {
      flushed = true;
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(flushed).toBe(false);
    resolveFirst(ok());
    await vi.advanceTimersByTimeAsync(0);
    expect(flushed).toBe(true);
  });

  it("flush is bounded by its wait budget when nothing confirms", async () => {
    sendMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    await vi.advanceTimersByTimeAsync(0);
    let flushed = false;
    void queue.flush(5_000).then(() => {
      flushed = true;
    });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(flushed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(flushed).toBe(true);
    expect(queue.getState().pending).toEqual([Q1]); // honest: still unsaved
  });

  it("records recovered questions for the 28c success banner", async () => {
    let fail = true;
    sendMock.mockImplementation(async () => {
      if (fail) throw new TypeError("Failed to fetch");
      return ok();
    });
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    queue.setAnswer(Q2, OPTION_B);
    await vi.advanceTimersByTimeAsync(0); // both fail, failingSince armed
    fail = false;
    queue.retryNow();
    await vi.advanceTimersByTimeAsync(0);

    const state = queue.getState();
    expect(state.recovered).toEqual([Q1, Q2]);
    expect(state.failingSince).toBeNull();

    queue.clearRecovered();
    expect(queue.getState().recovered).toBeNull();
  });

  it("resets the backoff after a success (next failure waits 1 s again)", async () => {
    let fail = true;
    sendMock.mockImplementation(async () => {
      if (fail) throw new TypeError("Failed to fetch");
      return ok();
    });
    const queue = createQueue();

    queue.setAnswer(Q1, OPTION_A);
    await vi.advanceTimersByTimeAsync(0); // fail #1 → 1 s backoff
    fail = false;
    await vi.advanceTimersByTimeAsync(1_000); // retry succeeds
    expect(queue.getState().pending).toEqual([]);

    fail = true;
    queue.setAnswer(Q1, OPTION_B); // call 3: sent immediately, fails
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999); // fresh 1 s backoff, not 2 s
    expect(sendMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(sendMock).toHaveBeenCalledTimes(4);
  });

  it("hydrate marks server-confirmed answers saved without sending", () => {
    sendMock.mockResolvedValue(ok());
    const queue = createQueue();

    queue.hydrate(Q1, OPTION_A);
    expect(sendMock).not.toHaveBeenCalled();
    expect(queue.getState()).toEqual({
      pending: [],
      saving: false,
      failingSince: null,
      recovered: null,
    });

    // A re-pick of the hydrated option still does not send.
    queue.setAnswer(Q1, OPTION_A);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("notifies subscribers on every state change", async () => {
    sendMock.mockResolvedValue(ok());
    const listener = vi.fn();
    const queue = createQueue();
    const unsubscribe = queue.subscribe(listener);

    queue.setAnswer(Q1, OPTION_A);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();

    await vi.runOnlyPendingTimersAsync();
    expect(listener).not.toHaveBeenCalled();
  });
});
