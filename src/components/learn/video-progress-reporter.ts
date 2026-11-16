// Video-position reporter (card S2-02 §5.C, permanent) — the ONE writer of
// POST /api/progress/video from the lesson page. Knows NOTHING about the
// video source: the engine hands it position/duration through `read`, so
// S2-02b's custom controls and S1-05's file engine reuse it unchanged.
//
// Rules (card table):
// - playing()  → start the 10 s tick timer (one timer even if called twice
//   in a row — YT order 1 → 3 → 1); every tick sends the current position.
// - paused()   → send the current position, stop the timer.
// - ended()    → send positionSeconds = durationSeconds (→ 100 %), stop.
// - pagehide while playing / dispose() while playing → last position with
//   keepalive: true, stop.
// - position = floor(currentTime), duration = round(duration), position
//   capped at duration; duration < 1 (unknown yet) → never send.
// - Ticks skip while a request is still running (one in-flight max);
//   paused/ended/pagehide/dispose ALWAYS send even then.
// - A position+duration equal to the last SUCCESSFUL send is not resent
//   (except ended).
// - 401/404/409 → stop sending for this lesson (session gone, lesson gone,
//   or locked again); network errors and 5xx are silently ignored (the
//   S2-01 beacon pattern — reading is never blocked by the recording).

export type VideoProgressPayload = {
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number;
};

export type VideoProgressSend = (
  payload: VideoProgressPayload,
  options?: { keepalive?: boolean },
) => Promise<Response>;

export type VideoProgressReporter = {
  playing(): void;
  paused(): void;
  ended(): void;
  dispose(): void;
};

const TICK_MS = 10_000;

type Snapshot = { positionSeconds: number; durationSeconds: number };

async function defaultSend(
  payload: VideoProgressPayload,
  options?: { keepalive?: boolean },
): Promise<Response> {
  return fetch("/api/progress/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: options?.keepalive === true,
  });
}

export function createVideoProgressReporter(config: {
  lessonId: string;
  read(): { positionSeconds: number; durationSeconds: number };
  send?: VideoProgressSend;
}): VideoProgressReporter {
  const send = config.send ?? defaultSend;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let stopped = false;
  let playing = false;
  let lastSent: Snapshot | null = null;

  function capture(): Snapshot {
    const raw = config.read();
    const durationSeconds = Math.round(raw.durationSeconds);
    const positionSeconds = Math.floor(raw.positionSeconds);
    return {
      durationSeconds,
      positionSeconds:
        durationSeconds >= 1
          ? Math.min(positionSeconds, durationSeconds)
          : positionSeconds,
    };
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function deliver(
    snapshot: Snapshot,
    options: { keepalive?: boolean; force?: boolean },
  ): Promise<void> {
    if (stopped) return;
    if (snapshot.durationSeconds < 1) return; // duration unknown yet
    if (
      !options.force &&
      lastSent !== null &&
      lastSent.positionSeconds === snapshot.positionSeconds &&
      lastSent.durationSeconds === snapshot.durationSeconds
    ) {
      return;
    }
    try {
      const response = await send(
        { lessonId: config.lessonId, ...snapshot },
        { keepalive: options.keepalive },
      );
      if (
        response.status === 401 ||
        response.status === 404 ||
        response.status === 409
      ) {
        stopped = true;
        playing = false;
        stopTimer();
        return;
      }
      lastSent = snapshot;
    } catch {
      // Network failure / thrown rejection: ignored — the next event or
      // tick retries. Never surfaces on the page.
    }
  }

  function tick(): void {
    // Only ticks respect the one-in-flight guard (card rule + review
    // item: flushes always go out).
    if (inFlight) return;
    const snapshot = capture();
    if (snapshot.durationSeconds < 1) return;
    if (
      lastSent !== null &&
      lastSent.positionSeconds === snapshot.positionSeconds &&
      lastSent.durationSeconds === snapshot.durationSeconds
    ) {
      return;
    }
    inFlight = true;
    void deliver(snapshot, {}).finally(() => {
      inFlight = false;
    });
  }

  function onLeave(options: { keepalive: boolean }): void {
    if (stopped || !playing) return;
    stopTimer();
    playing = false;
    void deliver(capture(), { keepalive: options.keepalive });
  }

  function onPageHide(): void {
    onLeave({ keepalive: true });
  }

  // pagehide (not beforeunload — it is unreliable on mobile and ignored
  // by bfcache-restores): fires while the video is playing → one last
  // keepalive flush. dispose() detaches this listener (review item).
  const hasWindow = typeof window !== "undefined";
  if (hasWindow) {
    window.addEventListener("pagehide", onPageHide);
  }

  return {
    playing() {
      if (stopped) return;
      playing = true;
      if (timer === null) {
        timer = setInterval(tick, TICK_MS);
      }
    },
    paused() {
      if (stopped) return;
      playing = false;
      stopTimer();
      void deliver(capture(), {});
    },
    ended() {
      if (stopped) return;
      playing = false;
      stopTimer();
      const snapshot = capture();
      if (snapshot.durationSeconds < 1) return;
      // 100 % — the stored percent is monotonic, so the capped position is
      // what marks the lesson fully watched.
      void deliver(
        { ...snapshot, positionSeconds: snapshot.durationSeconds },
        { force: true },
      );
    },
    dispose() {
      onLeave({ keepalive: true });
      if (hasWindow) {
        window.removeEventListener("pagehide", onPageHide);
      }
    },
  };
}
