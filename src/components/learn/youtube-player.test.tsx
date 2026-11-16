// @vitest-environment jsdom
import "../ui/test-env";

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { YouTubePlayer } from "./youtube-player";

// Card S2-02 §5.B tests. Two layers:
// - the loader: one script per page no matter how many callers, the
//   pre-existing onYouTubeIframeAPIReady handler still runs, onerror and
//   the 15 s timeout reject. The module caches its promise, so every
//   loader test works on a FRESH module registry (vi.resetModules +
//   dynamic import) — the top-level import below stays pristine for the
//   component tests.
// - the component: it renders the iframe itself (React-owned), attaches a
//   YT.Player once the API resolves, maps states 1/2/0, passes errors
//   through, and ignores everything after unmount.
//
// jsdom never fetches the inserted <script>, so resolving the loader is
// the test's job: set window.YT, then call window.onYouTubeIframeAPIReady().

const IFRAME_API_URL = "https://www.youtube.com/iframe_api";

type FakeConfig = {
  events?: {
    onReady?: () => void;
    onStateChange?: (event: { data: number }) => void;
    onError?: (event: { data: number }) => void;
  };
};

/** Minimal YT.Player double: records the element it attached to and lets
 *  the test drive ready/state/error by hand. */
class FakePlayer {
  static instances: FakePlayer[] = [];
  static get last(): FakePlayer {
    return FakePlayer.instances[FakePlayer.instances.length - 1]!;
  }
  readonly element: HTMLElement;
  readonly config: FakeConfig;
  currentTime = 0;
  duration = 0;
  seeks: Array<[seconds: number, allowSeekAhead: boolean]> = [];
  constructor(element: HTMLElement, config: FakeConfig) {
    this.element = element;
    this.config = config;
    FakePlayer.instances.push(this);
  }
  getCurrentTime(): number {
    return this.currentTime;
  }
  getDuration(): number {
    return this.duration;
  }
  seekTo(seconds: number, allowSeekAhead: boolean): void {
    this.seeks.push([seconds, allowSeekAhead]);
  }
  ready(): void {
    this.config.events?.onReady?.();
  }
  emit(data: number): void {
    this.config.events?.onStateChange?.({ data });
  }
  error(code: number): void {
    this.config.events?.onError?.({ data: code });
  }
}

function installFakeYouTube(): void {
  window.YT = { Player: FakePlayer } as unknown as Window["YT"];
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  FakePlayer.instances = [];
  installFakeYouTube();
});

// --- the loader (fresh module registry per test) ----------------------------

describe("loadYouTubeIframeApi", () => {
  /** A fresh copy of the module — and thus a fresh cached promise. */
  async function freshLoader() {
    vi.resetModules();
    const mod = await import("./youtube-player");
    return mod.loadYouTubeIframeApi;
  }

  function insertedScripts(): HTMLScriptElement[] {
    return Array.from(document.head.querySelectorAll("script")).filter(
      (script) => script.src === IFRAME_API_URL,
    );
  }

  it("inserts ONE script for two concurrent callers and resolves both with the same namespace", async () => {
    const load = await freshLoader();
    const first = load();
    const second = load();
    expect(insertedScripts()).toHaveLength(1);

    window.onYouTubeIframeAPIReady?.();
    const namespaces = new Set(await Promise.all([first, second]));
    expect(namespaces.size).toBe(1);
    expect((await first).Player).toBe(FakePlayer);
  });

  it("still runs a handler that was already registered on onYouTubeIframeAPIReady", async () => {
    const load = await freshLoader();
    const previous = vi.fn();
    window.onYouTubeIframeAPIReady = previous;

    const pending = load();
    window.onYouTubeIframeAPIReady?.();
    await expect(pending).resolves.toBeDefined();
    expect(previous).toHaveBeenCalledTimes(1);
  });

  it("rejects when the script fails to load (onerror)", async () => {
    const load = await freshLoader();
    const pending = load();
    // jsdom never fires resource-load onerror for a dispatched Event, so
    // invoke the handler the loader installed — the same code path. Scripts
    // from earlier fresh-registry tests stay in <head>; take the LAST one.
    const script = insertedScripts().at(-1)!;
    expect(script.onerror).toBeInstanceOf(Function);
    script.onerror?.(new Event("error"));
    await expect(pending).rejects.toThrow("failed to load");
  });

  it("rejects after 15 s without the API becoming ready", async () => {
    vi.useFakeTimers();
    try {
      const load = await freshLoader();
      const pending = load();
      // Attach the rejection handler BEFORE the timer fires, or the
      // rejection would be "unhandled" for a tick.
      const expectation = expect(pending).rejects.toThrow(
        "did not become ready",
      );
      await vi.advanceTimersByTimeAsync(15_000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});

// --- the component (top-level import: one shared, resolvable promise) -------

function playerElement(
  overrides: Partial<Parameters<typeof YouTubePlayer>[0]> = {},
) {
  const onReady = vi.fn();
  const onStateChange = vi.fn();
  const onError = vi.fn();
  const view = render(
    <YouTubePlayer
      videoId="e2eVideo001"
      origin="http://localhost:3100"
      lessonTitle="Judul materi"
      startSeconds={0}
      onReady={onReady}
      onStateChange={onStateChange}
      onError={onError}
      {...overrides}
    />,
  );
  return { view, onReady, onStateChange, onError };
}

describe("YouTubePlayer", () => {
  it("renders the nocookie iframe with jsapi + origin even before the API loads", () => {
    const { view } = playerElement();
    const iframe = view.container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/e2eVideo001" +
        "?enablejsapi=1&origin=http%3A%2F%2Flocalhost%3A3100" +
        "&rel=0&playsinline=1&iv_load_policy=3",
    );
    expect(iframe!.getAttribute("title")).toBe("Video: Judul materi");
    expect(iframe!.getAttribute("referrerPolicy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(iframe!.getAttribute("allowFullScreen")).not.toBeNull();
  });

  it("attaches a YT.Player to the IFRAME element once the API resolves", async () => {
    const { onReady } = playerElement();
    // First consumer in this file resolves the module-level promise.
    window.onYouTubeIframeAPIReady?.();
    await flush();

    expect(FakePlayer.instances).toHaveLength(1);
    const player = FakePlayer.last;
    expect(player.element.tagName).toBe("IFRAME");

    player.currentTime = 41.9;
    player.duration = 100.4;
    player.ready();
    const handle = await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
      return onReady.mock.calls[0]![0];
    });
    expect(handle.read()).toEqual({
      positionSeconds: 41.9,
      durationSeconds: 100.4,
    });
    handle.seekTo(0, true);
    expect(player.seeks).toEqual([[0, true]]);
  });

  it("maps YT states 1/2/0 to playing/paused/ended and ignores 3/5", async () => {
    const { onStateChange } = playerElement();
    window.onYouTubeIframeAPIReady?.();
    await flush();

    FakePlayer.last.emit(3);
    FakePlayer.last.emit(5);
    expect(onStateChange).not.toHaveBeenCalled();
    FakePlayer.last.emit(1);
    FakePlayer.last.emit(2);
    FakePlayer.last.emit(0);
    expect(onStateChange.mock.calls.map((call) => call[0])).toEqual([
      "playing",
      "paused",
      "ended",
    ]);
  });

  it("passes the error code through", async () => {
    const { onError } = playerElement();
    window.onYouTubeIframeAPIReady?.();
    await flush();

    FakePlayer.last.error(150);
    expect(onError).toHaveBeenCalledWith(150);
  });

  it("ignores ready/state/error after unmount (no destroy)", async () => {
    const { view, onReady, onStateChange, onError } = playerElement();
    window.onYouTubeIframeAPIReady?.();
    await flush();

    const player = FakePlayer.last;
    view.unmount();
    player.ready();
    player.emit(1);
    player.error(101);
    await flush();
    expect(onReady).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("renders without crashing while the API never resolves (silent failure)", async () => {
    // The module-level promise is long resolved here, so drive a FRESH
    // registry that never receives the ready callback.
    vi.resetModules();
    const { YouTubePlayer: FreshPlayer } = await import("./youtube-player");
    const view = render(
      <FreshPlayer
        videoId="e2eVideo001"
        origin="http://localhost:3100"
        lessonTitle="Judul materi"
        startSeconds={0}
        onReady={() => {}}
        onStateChange={() => {}}
        onError={() => {}}
      />,
    );
    await flush();
    // No player attached, no crash, iframe still playable by hand.
    expect(FakePlayer.instances).toHaveLength(0);
    expect(view.container.querySelector("iframe")).not.toBeNull();
    expect(screen.queryByText(/gagal/i)).toBeNull();
  });
});
