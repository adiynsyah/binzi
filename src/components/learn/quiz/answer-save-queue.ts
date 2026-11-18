// Answer save queue (card S3-01 §4.B, QZ-09) — the ONE writer of
// PUT /api/quiz/attempts/{attemptId}/answers/{questionId} from the quiz
// runner. Pure module on purpose (no React — tested like the S2-02 video
// reporter with an injected `send`).
//
// Rules (card table):
// - setAnswer(q, o) → a PUT for that question; the LATEST choice wins. A
//   new pick that lands while an older request is in flight is re-sent
//   right after the older one settles.
// - hydrate(q, o) → marks a server-confirmed answer saved WITHOUT sending
//   (the running DTO's `answers` arrive already persisted — QZ-08).
// - Network failure / 5xx → retried after 1, 2, 5 s, then every 5 s.
// - 409 → stop, hand over to `onFinalized` (the runner collects +
//   refreshes — the attempt was finalized elsewhere, e.g. the server clock
//   ran past the tolerance).
// - 404 → stop, hand over to `onGone` (attempt/lesson gone — refresh).
//   Any other definitive non-5xx (401 session, 400 contract) stops the
//   same way: retrying a definitive answer cannot help.
// - retryNow() → "Coba kirim sekarang": clears the backoff timer and
//   sends every pending question immediately.
// - flush(maxWaitMs) → the timer-zero path: sends everything pending now
//   and resolves when all are confirmed OR the wait budget is spent
//   (≤ 5 s per the card). Unresolved answers stay unsaved — the submit
//   grades them wrong, which is the honest outcome.

export type SaveAnswerRequest = {
  attemptId: string;
  questionId: string;
  optionId: string;
};

export type SaveAnswerSend = (request: SaveAnswerRequest) => Promise<Response>;

export type AnswerSaveState = {
  /** Question ids whose LATEST choice is not confirmed by the server. */
  pending: string[];
  /** True while at least one request is in flight. */
  saving: boolean;
  /** Epoch ms of the first still-unresolved failure (null while healthy) —
   *  the 28c stages key off this (< 10 s indicator only, > 10 s banner). */
  failingSince: number | null;
  /** Questions recovered by the last all-saved transition after an outage
   *  (the 28c success banner list); null until then. */
  recovered: string[] | null;
};

export type AnswerSaveQueue = {
  setAnswer(questionId: string, optionId: string): void;
  hydrate(questionId: string, optionId: string): void;
  retryNow(): void;
  flush(maxWaitMs: number): Promise<void>;
  getState(): AnswerSaveState;
  clearRecovered(): void;
  subscribe(listener: (state: AnswerSaveState) => void): () => void;
  dispose(): void;
};

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000] as const;

type Entry = {
  optionId: string;
  saved: boolean;
  sending: boolean;
  /** What the in-flight request carried — mismatch vs `optionId` after a
   *  success means a newer pick is waiting (latest wins). */
  sentOptionId: string | null;
};

async function defaultSend(request: SaveAnswerRequest): Promise<Response> {
  return fetch(
    `/api/quiz/attempts/${request.attemptId}/answers/${request.questionId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: request.optionId }),
    },
  );
}

export function createAnswerSaveQueue(config: {
  attemptId: string;
  send?: SaveAnswerSend;
  onFinalized?: () => void;
  onGone?: () => void;
}): AnswerSaveQueue {
  const send = config.send ?? defaultSend;
  const entries = new Map<string, Entry>();
  const listeners = new Set<(state: AnswerSaveState) => void>();
  const failedQuestions = new Set<string>();
  let stopped = false;
  let savingCount = 0;
  let failingSince: number | null = null;
  let recovered: string[] | null = null;
  let failureStreak = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const flushWaiters = new Set<{
    resolve: () => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  function allConfirmed(): boolean {
    for (const entry of entries.values()) {
      if (!entry.saved) return false;
    }
    return true;
  }

  // The state object is CACHED and only rebuilt on a mutation, so
  // useSyncExternalStore can compare snapshots by identity.
  let cachedState: AnswerSaveState = {
    pending: [],
    saving: false,
    failingSince: null,
    recovered: null,
  };

  function getState(): AnswerSaveState {
    return cachedState;
  }

  function notify(): void {
    const pending: string[] = [];
    for (const [questionId, entry] of entries) {
      if (!entry.saved) pending.push(questionId);
    }
    cachedState = {
      pending,
      saving: savingCount > 0,
      failingSince,
      recovered,
    };
    for (const listener of listeners) {
      listener(cachedState);
    }
  }

  /** Resolves flush() waiters once nothing is left unconfirmed. */
  function wakeFlushWaiters(): void {
    if (!allConfirmed()) return;
    for (const waiter of flushWaiters) {
      clearTimeout(waiter.timer);
      flushWaiters.delete(waiter);
      waiter.resolve();
    }
  }

  /** The 28c stage-3 transition: an outage healed, everything confirmed. */
  function onMaybeRecovered(): void {
    if (failingSince === null || !allConfirmed()) return;
    recovered = [...failedQuestions];
    failingSince = null;
    failedQuestions.clear();
    failureStreak = 0;
  }

  function stop(): void {
    stopped = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    // flush() must never hang past its budget — resolve waiters now.
    for (const waiter of flushWaiters) {
      clearTimeout(waiter.timer);
      flushWaiters.delete(waiter);
      waiter.resolve();
    }
  }

  function pump(): void {
    if (stopped) return;
    for (const [questionId, entry] of entries) {
      if (!entry.saved && !entry.sending) {
        void sendOne(questionId);
      }
    }
  }

  /** "Coba kirim sekarang" / flush(): drop the backoff timer, send now. */
  function retryNowFn(): void {
    if (stopped) return;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    pump();
  }

  function scheduleRetry(): void {
    if (stopped || retryTimer !== null) return;
    const delay =
      RETRY_DELAYS_MS[Math.min(failureStreak, RETRY_DELAYS_MS.length - 1)]!;
    failureStreak += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      pump();
    }, delay);
  }

  function onSendFailure(questionId: string): void {
    failedQuestions.add(questionId);
    if (failingSince === null) {
      failingSince = Date.now();
    }
    scheduleRetry();
    notify();
  }

  function sendOne(questionId: string): void {
    const entry = entries.get(questionId);
    if (stopped || !entry || entry.sending) return;
    entry.sending = true;
    entry.sentOptionId = entry.optionId;
    savingCount += 1;
    notify();
    void deliver(questionId, entry.sentOptionId);
  }

  async function deliver(
    questionId: string,
    sentOptionId: string,
  ): Promise<void> {
    const entry = entries.get(questionId);
    if (!entry) return;
    try {
      const response = await send({
        attemptId: config.attemptId,
        questionId,
        optionId: sentOptionId,
      });
      entry.sending = false;
      savingCount -= 1;
      if (stopped) return;

      if (response.ok) {
        failureStreak = 0;
        if (entry.sentOptionId === entry.optionId) {
          entry.saved = true;
          onMaybeRecovered();
          wakeFlushWaiters();
        } else {
          // Latest wins: a newer pick arrived mid-flight — send it now.
          sendOne(questionId);
          return;
        }
        notify();
        return;
      }
      if (response.status === 409) {
        stop();
        notify();
        config.onFinalized?.();
        return;
      }
      if (response.status >= 500) {
        onSendFailure(questionId);
        return;
      }
      // 404 and every other definitive non-5xx: stop, let the page refresh.
      stop();
      notify();
      config.onGone?.();
    } catch {
      entry.sending = false;
      savingCount -= 1;
      if (stopped) return;
      onSendFailure(questionId);
    }
  }

  return {
    setAnswer(questionId, optionId) {
      if (stopped) return;
      const entry = entries.get(questionId);
      if (!entry) {
        entries.set(questionId, {
          optionId,
          saved: false,
          sending: false,
          sentOptionId: null,
        });
        sendOne(questionId);
        return;
      }
      if (entry.optionId === optionId && (entry.saved || entry.sending)) {
        // Re-picking the option that is already stored/in flight.
        return;
      }
      entry.optionId = optionId;
      entry.saved = false;
      if (!entry.sending) {
        sendOne(questionId);
      } else {
        // In flight with the older pick — deliver() re-sends on mismatch.
        notify();
      }
    },
    hydrate(questionId, optionId) {
      if (stopped) return;
      entries.set(questionId, {
        optionId,
        saved: true,
        sending: false,
        sentOptionId: optionId,
      });
      notify();
    },
    retryNow: retryNowFn,
    flush(maxWaitMs) {
      if (allConfirmed()) return Promise.resolve();
      retryNowFn();
      return new Promise<void>((resolve) => {
        const waiter = {
          resolve,
          timer: setTimeout(() => {
            flushWaiters.delete(waiter);
            resolve();
          }, maxWaitMs),
        };
        flushWaiters.add(waiter);
      });
    },
    getState,
    clearRecovered() {
      if (recovered === null) return;
      recovered = null;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      stop();
      listeners.clear();
    },
  };
}
