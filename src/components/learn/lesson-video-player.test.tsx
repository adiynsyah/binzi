// @vitest-environment jsdom
import "../ui/test-env";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlaybackDTO } from "@/modules/progress/service";

import { LessonVideoPlayer } from "./lesson-video-player";

// The player calls router.refresh() for the S3-01 quiz unlock — mocked
// like every other navigation consumer in this suite.
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: refreshMock,
  }),
}));

// Card S2-02 §5.A tests: the permanent wrapper around the demo engine —
// the 16:9 frame (server-rendered, no layout jump), the iframe appearing
// only after mount (it needs window.location.origin), the resume row
// rules, "Mulai dari awal", the network-failure banner, and the wiring
// into the reporter. The YouTube engine is the REAL one with a FakePlayer
// double on window.YT (same pattern as youtube-player.test.tsx; this file
// has its own module registry, so its loader starts fresh).
//
// jsdom does not apply CSS: `aspect-video` presence is asserted as a
// class, not as a computed 16:9 box.

const LESSON_ID = "1f0c2a34-1111-4111-8111-111111111111";
const YOUTUBE_PLAYBACK: PlaybackDTO = {
  kind: "youtube",
  videoId: "e2eVideo001",
  durationSeconds: 252,
};

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

type FakeConfig = {
  events?: {
    onReady?: () => void;
    onStateChange?: (event: { data: number }) => void;
    onError?: (event: { data: number }) => void;
  };
};

/** Minimal YT.Player double — driven by hand from the test. */
class FakePlayer {
  static instances: FakePlayer[] = [];
  static get last(): FakePlayer {
    return FakePlayer.instances[FakePlayer.instances.length - 1]!;
  }
  currentTime = 0;
  duration = 0;
  seeks: Array<[seconds: number, allowSeekAhead: boolean]> = [];
  readonly config: FakeConfig;
  constructor(_element: HTMLElement, config: FakeConfig) {
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

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Renders, resolves the (file-local) API loader, and hands back the
 *  attached FakePlayer with the handle ready. */
async function renderAttached(
  overrides: Partial<Parameters<typeof LessonVideoPlayer>[0]> = {},
) {
  window.YT = { Player: FakePlayer } as unknown as Window["YT"];
  const view = render(
    <LessonVideoPlayer
      lessonId={LESSON_ID}
      lessonTitle="Judul materi"
      playback={YOUTUBE_PLAYBACK}
      resumeFromSeconds={0}
      {...overrides}
    />,
  );
  // The file's loader promise resolves on the FIRST call; later renders
  // share the settled promise and attach after one microtask flush.
  window.onYouTubeIframeAPIReady?.();
  await flush();
  return view;
}

function frameOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector(".aspect-video");
}

function iframeOf(container: HTMLElement): HTMLIFrameElement | null {
  return frameOf(container)?.querySelector("iframe") ?? null;
}

beforeEach(() => {
  FakePlayer.instances = [];
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  refreshMock.mockReset();
});

// --- structure: who may touch the demo engine --------------------------------

describe("LessonVideoPlayer — engine encapsulation", () => {
  it("youtube-player.tsx is imported ONLY by lesson-video-player.tsx (C-10 blast radius)", () => {
    // Walk src/ for real imports of the demo engine — the day C-10 deletes
    // it, this file list is the complete checklist. Tests are excluded:
    // they are deleted together with the engine.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (
          /\.(ts|tsx)$/.test(entry.name) &&
          !/\.(test|integration)\.[jt]sx?$/.test(entry.name) &&
          readFileSync(path, "utf8").includes('"./youtube-player"')
        ) {
          offenders.push(path);
        }
      }
    };
    walk(join(import.meta.dirname, "../../"));
    expect(offenders).toEqual([
      expect.stringContaining("lesson-video-player.tsx"),
    ]);
  });
});

// --- the frame & the iframe ----------------------------------------------------

describe("LessonVideoPlayer — frame", () => {
  it("server-renders the 16:9 frame, never the iframe (origin needs the client)", () => {
    // RTL's render() auto-flushes effects, so the pre-mount output is
    // asserted through the REAL server render — same first paint the
    // lesson page ships: frame + resume row, no iframe, no layout jump.
    const html = renderToString(
      <LessonVideoPlayer
        lessonId={LESSON_ID}
        lessonTitle="Judul materi"
        playback={YOUTUBE_PLAYBACK}
        resumeFromSeconds={84}
      />,
    );
    expect(html).toContain("aspect-video");
    // React SSR splits static text and the interpolated clock with a
    // comment node — assert both halves instead of the joined string.
    expect(html).toContain("Melanjutkan dari");
    expect(html).toContain("01:24");
    expect(html).not.toContain("<iframe");
  });

  it("mounts the nocookie iframe with title/allow/referrerPolicy and the page origin", async () => {
    const view = await renderAttached();
    const iframe = iframeOf(view.container);
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/e2eVideo001" +
        "?enablejsapi=1&origin=" +
        encodeURIComponent(window.location.origin) +
        "&rel=0&playsinline=1&iv_load_policy=3",
    );
    expect(iframe!.getAttribute("title")).toBe("Video: Judul materi");
    expect(iframe!.getAttribute("referrerPolicy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(iframe!.getAttribute("allow")).toContain("encrypted-media");
  });
});

// --- the resume row -------------------------------------------------------------

describe("LessonVideoPlayer — resume row", () => {
  it("position 84 → 'Melanjutkan dari 01:24' and start=84 in the iframe", async () => {
    const view = await renderAttached({ resumeFromSeconds: 84 });
    expect(screen.getByText("Melanjutkan dari 01:24")).toBeTruthy();
    expect(iframeOf(view.container)!.getAttribute("src")).toContain("start=84");
  });

  it("position 3 (below the 5 s threshold) → no row, no start param", async () => {
    const view = await renderAttached({ resumeFromSeconds: 3 });
    expect(screen.queryByText(/Melanjutkan dari/)).toBeNull();
    expect(iframeOf(view.container)!.getAttribute("src")).not.toContain(
      "start=",
    );
  });

  it("within 5 s of the known end → no row (nothing worth resuming)", async () => {
    await renderAttached({
      resumeFromSeconds: 248,
      playback: { ...YOUTUBE_PLAYBACK, durationSeconds: 252 },
    });
    expect(screen.queryByText(/Melanjutkan dari/)).toBeNull();
  });

  it("unknown duration (null) → the row relies on the position alone", async () => {
    await renderAttached({
      resumeFromSeconds: 84,
      playback: { ...YOUTUBE_PLAYBACK, durationSeconds: null },
    });
    expect(screen.getByText("Melanjutkan dari 01:24")).toBeTruthy();
  });

  it("'Mulai dari awal' seeks to 0 and hides the row (enabled once the engine is ready)", async () => {
    await renderAttached({ resumeFromSeconds: 84 });
    const button = screen.getByRole("button", { name: "Mulai dari awal" });
    expect((button as HTMLButtonElement).disabled).toBe(true); // engine not ready

    FakePlayer.last.ready();
    await flush();
    expect((button as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(button);
    expect(FakePlayer.last.seeks).toEqual([[0, true]]);
    expect(screen.queryByText(/Melanjutkan dari/)).toBeNull();
  });
});

// --- the failure banner ----------------------------------------------------------

describe("LessonVideoPlayer — engine error", () => {
  it("error 150 → the network banner appears under the untouched frame", async () => {
    const view = await renderAttached();
    FakePlayer.last.error(150);
    await flush();

    expect(
      screen.getByText("Video gagal dimuat di jaringan ini."),
    ).toBeTruthy();
    expect(
      screen.getByText("Teks materi & quiz tetap bisa dikerjakan."),
    ).toBeTruthy();
    // The frame and iframe stay — YouTube renders its own error inside the
    // embed; only the recording/reporting is gone.
    expect(iframeOf(view.container)).not.toBeNull();
  });
});

// --- the reporter wiring ----------------------------------------------------------

describe("LessonVideoPlayer — reporter wiring", () => {
  it("playing → a 10 s tick POSTs /api/progress/video with this lesson's id", async () => {
    vi.useFakeTimers();
    try {
      await renderAttached();
      FakePlayer.last.ready();
      FakePlayer.last.currentTime = 12;
      FakePlayer.last.duration = 100;
      FakePlayer.last.emit(1); // playing

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/api/progress/video");
      expect((init as RequestInit).method).toBe("POST");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        lessonId: LESSON_ID,
        positionSeconds: 12,
        durationSeconds: 100,
      });

      FakePlayer.last.currentTime = 20; // paused must beat the dedupe
      FakePlayer.last.emit(2); // paused → immediate flush, timer stops
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("unmount flushes with keepalive and stops the ticks", async () => {
    vi.useFakeTimers();
    try {
      const view = await renderAttached();
      FakePlayer.last.ready();
      FakePlayer.last.currentTime = 30;
      FakePlayer.last.duration = 100;
      FakePlayer.last.emit(1); // playing

      view.unmount();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({
        lessonId: LESSON_ID,
        positionSeconds: 30,
        durationSeconds: 100,
      });
      expect((init as { keepalive?: boolean }).keepalive).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// --- the quiz-unlock refresh (card S3-01 §3, keputusan 9) ------------------------

/** A 2xx progress response carrying the route's data JSON. */
function okVideoJson(
  positionSeconds: number,
  watchedPercent: number,
): Response {
  return new Response(
    JSON.stringify({ data: { positionSeconds, watchedPercent } }),
    { status: 200 },
  );
}

describe("LessonVideoPlayer — quiz-unlock refresh (S3-01)", () => {
  it("refreshAtPercent: the FIRST watchedPercent ≥ value refreshes once", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async () => okVideoJson(95, 95));
      await renderAttached({ refreshAtPercent: 90 });
      FakePlayer.last.ready();
      FakePlayer.last.currentTime = 95;
      FakePlayer.last.duration = 100;
      FakePlayer.last.emit(1); // playing

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(refreshMock).toHaveBeenCalledTimes(1);

      // Later recordings at/above the threshold never refresh again.
      FakePlayer.last.currentTime = 100;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(refreshMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("below the threshold: the POST still happens, no refresh", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async () => okVideoJson(50, 50));
      await renderAttached({ refreshAtPercent: 90 });
      FakePlayer.last.ready();
      FakePlayer.last.currentTime = 50;
      FakePlayer.last.duration = 100;
      FakePlayer.last.emit(1); // playing

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(refreshMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("no refreshAtPercent → watching is off entirely", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async () => okVideoJson(95, 95));
      await renderAttached();
      FakePlayer.last.ready();
      FakePlayer.last.currentTime = 95;
      FakePlayer.last.duration = 100;
      FakePlayer.last.emit(1); // playing

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(refreshMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a refreshAtPercent change after the refresh keeps the reporter ticking", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async () => okVideoJson(95, 95));
      const view = await renderAttached({ refreshAtPercent: 90 });
      FakePlayer.last.ready();
      FakePlayer.last.currentTime = 95;
      FakePlayer.last.duration = 100;
      FakePlayer.last.emit(1); // playing

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(refreshMock).toHaveBeenCalledTimes(1);

      // The refresh lands a new page → the player re-renders with the prop
      // gone (quiz now eligible). The reporter must NOT be recreated: a
      // fresh one never receives .playing(), so the ticks would die and
      // progress recording would silently stop.
      view.rerender(
        <LessonVideoPlayer
          lessonId={LESSON_ID}
          lessonTitle="Judul materi"
          playback={YOUTUBE_PLAYBACK}
          resumeFromSeconds={0}
        />,
      );
      FakePlayer.last.currentTime = 100;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchMock.mock.calls.filter(([url]) => url === "/api/progress/video"))
        .toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
