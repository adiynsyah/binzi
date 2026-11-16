// @vitest-environment jsdom
import "../ui/test-env";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LessonPage } from "./lesson-page";
import type {
  LessonOutlineItemDTO,
  LessonPageDTO,
  PlaybackDTO,
} from "@/modules/progress/service";

// Card S2-01 §4 + "Selesai jika · Tes komponen": the three page states with
// exactly one h1 each, the three bottom-bar `next` forms (and no prev at
// position 1), the summary counts, and the not-enrolled wiring.
//
// jsdom does NOT apply CSS, so `hidden lg:block` / `lg:hidden` never hide
// anything: LessonOutlineNav genuinely renders TWICE per page here. The
// "only one" assertions are scoped with within(), and the two copies are
// asserted on purpose — never weakened to a single getAllByRole length 1.
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const LESSON_ID = "1f0c2a34-1111-4111-8111-111111111111";
const COURSE = { slug: "gizi-seimbang", title: "Gizi Seimbang" };
const HREF = (n: number) => `/belajar/gizi-seimbang/materi-${n}`;
const CONTENT_DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Isi materi uji S2-01." }],
    },
  ],
};

function outlineItem(
  position: number,
  state: LessonOutlineItemDTO["state"],
): LessonOutlineItemDTO {
  return {
    position,
    title: `Judul materi ${position}`,
    state,
    href: state === "terkunci" ? null : HREF(position),
  };
}

type OpenDTO = Extract<LessonPageDTO, { state: "open" }>;

function openDto(
  overrides: {
    outline?: LessonOutlineItemDTO[];
    prevHref?: string | null;
    next?: OpenDTO["next"];
    progress?: OpenDTO["progress"];
    playback?: PlaybackDTO | null;
    lessonId?: string;
  } = {},
): OpenDTO {
  return {
    state: "open",
    course: { ...COURSE, lessonCount: 3, completedLessonCount: 1 },
    lesson: {
      id: overrides.lessonId ?? LESSON_ID,
      title: "Judul materi 2",
      position: 2,
      content: CONTENT_DOC,
      playback: overrides.playback ?? null,
    },
    progress: overrides.progress ?? null,
    outline: overrides.outline ?? [
      outlineItem(1, "selesai"),
      outlineItem(2, "kini"),
      outlineItem(3, "terkunci"),
    ],
    prevHref: overrides.prevHref ?? HREF(1),
    // ?? would turn an explicit `null` back into the default — the three
    // next-forms test NEEDS null to stay null.
    next:
      overrides.next !== undefined
        ? overrides.next
        : { kind: "link", href: HREF(3) },
  };
}

function lockedDto(
  unlock: { position: number; href: string } | null = {
    position: 1,
    href: HREF(1),
  },
): LessonPageDTO {
  return {
    state: "locked",
    course: { ...COURSE, lessonCount: 3, completedLessonCount: 1 },
    lesson: { title: "Judul materi 2", position: 2 },
    unlock,
    outline: [
      outlineItem(1, "selesai"),
      outlineItem(2, "kini"),
      outlineItem(3, "terkunci"),
    ],
  };
}

const NOT_ENROLLED_DTO: LessonPageDTO = {
  state: "not-enrolled",
  course: { id: "course-uuid", title: COURSE.title },
  lesson: { title: "Judul materi 1", position: 1 },
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
});

describe("LessonPage — shared chrome", () => {
  it.each([
    ["open", openDto()],
    ["locked", lockedDto()],
    ["not-enrolled", NOT_ENROLLED_DTO],
  ])("%s state has exactly one h1 naming the lesson", (_label, dto) => {
    render(<LessonPage data={dto} />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    const position = dto.lesson.position;
    expect(h1s[0]!.textContent).toBe(
      `Materi ${position} · Judul materi ${position}`,
    );
  });

  it("course bar links back to /belajar and names the course", () => {
    render(<LessonPage data={openDto()} />);
    const back = screen.getByRole("link", { name: "Belajar" });
    expect(back.getAttribute("href")).toBe("/belajar");
    expect(screen.getByText(COURSE.title)).toBeTruthy();
  });

  it("open shows the course progress bar and the SELESAI count", () => {
    render(<LessonPage data={openDto()} />);
    expect(
      screen.getByRole("progressbar", {
        name: `Progress kursus ${COURSE.title}`,
      }),
    ).toBeTruthy();
    expect(screen.getByText("1/3 SELESAI")).toBeTruthy();
  });

  it("locked shows the course progress too", () => {
    render(<LessonPage data={lockedDto()} />);
    expect(
      screen.getByRole("progressbar", {
        name: `Progress kursus ${COURSE.title}`,
      }),
    ).toBeTruthy();
  });

  it("not-enrolled shows no progress bar", () => {
    render(<LessonPage data={NOT_ENROLLED_DTO} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("LessonPage — open state", () => {
  it("renders the material document and POSTs /open exactly once (beacon)", async () => {
    render(<LessonPage data={openDto()} />);
    expect(screen.getByText("Isi materi uji S2-01.")).toBeTruthy();
    await actAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `/api/progress/lessons/${LESSON_ID}/open`,
    );
  });

  it("bottom bar: prev link + next link when the successor is open", () => {
    render(<LessonPage data={openDto()} />);
    const prev = screen.getByRole("link", { name: "Materi sebelumnya" });
    expect(prev.getAttribute("href")).toBe(HREF(1));
    const next = screen.getByRole("link", { name: "Materi berikutnya" });
    expect(next.getAttribute("href")).toBe(HREF(3));
  });

  it("bottom bar: prevHref null at position 1 → no prev link", () => {
    const firstLesson = openDto({ prevHref: null });
    render(
      <LessonPage
        data={{
          ...firstLesson,
          lesson: { ...firstLesson.lesson, position: 1 },
          prevHref: null,
        }}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Materi sebelumnya" }),
    ).toBeNull();
  });

  it("bottom bar: locked successor → the quiz note, no next link", () => {
    render(
      <LessonPage
        data={openDto({ next: { kind: "terkunci", position: 3 } })}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Materi berikutnya" }),
    ).toBeNull();
    expect(
      screen.getByText("Materi 3 terbuka setelah quiz materi ini dikerjakan."),
    ).toBeTruthy();
  });

  it("bottom bar: last lesson → neither next link nor note", () => {
    render(<LessonPage data={openDto({ next: null })} />);
    expect(
      screen.queryByRole("link", { name: "Materi berikutnya" }),
    ).toBeNull();
    expect(screen.queryByText(/terbuka setelah quiz/)).toBeNull();
  });

  it("renders the outline in TWO places (side card + details) with one kini each", () => {
    render(<LessonPage data={openDto()} />);
    // jsdom ignores `hidden lg:block` / `lg:hidden` — both navs exist.
    const navs = screen.getAllByRole("navigation", { name: "Daftar materi" });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      const kini = within(nav)
        .getAllByRole("link")
        .filter((node) => node.getAttribute("aria-current") === "page");
      expect(kini).toHaveLength(1);
      expect(within(nav).getByText("2 · Judul materi 2")).toBeTruthy();
    }
  });

  it("the <1024 <details> summary carries the counts", () => {
    render(<LessonPage data={openDto()} />);
    const counts = screen.getByText("1 SELESAI · 1 TERKUNCI");
    const details = counts.closest("details");
    expect(details).not.toBeNull();
    expect(
      within(details as NonNullable<typeof details>).getByText("Daftar materi"),
    ).toBeTruthy();
  });
});

describe("LessonPage — locked state", () => {
  it("shows the panel with the unlock action and no material", () => {
    render(<LessonPage data={lockedDto()} />);
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Materi ini belum terbuka",
      }),
    ).toBeTruthy();
    expect(screen.getByText("MATERI 2 · TERKUNCI")).toBeTruthy();
    const open = screen.getByRole("link", { name: "Buka materi 1" });
    expect(open.getAttribute("href")).toBe(HREF(1));
    expect(
      screen
        .getByRole("link", { name: "Kembali ke Belajar" })
        .getAttribute("href"),
    ).toBe("/belajar");
    // V-06: the locked page never renders the material.
    expect(screen.queryByText("Isi materi uji S2-01.")).toBeNull();
    // …and the beacon is open-state only.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the summary counts the viewed locked lesson itself: a 2-lesson course shows '0 SELESAI · 1 TERKUNCI'", () => {
    // The viewed lesson is "kini" (priority) and the only other lesson is
    // "terbuka" — ZERO "terkunci" rows — yet the page IS locked, so the
    // summary must count the viewed lesson itself.
    const dto: LessonPageDTO = {
      state: "locked",
      course: {
        ...COURSE,
        lessonCount: 2,
        completedLessonCount: 0,
      },
      lesson: { title: "Judul materi 2", position: 2 },
      unlock: { position: 1, href: HREF(1) },
      outline: [outlineItem(1, "terbuka"), outlineItem(2, "kini")],
    };
    render(<LessonPage data={dto} />);
    expect(screen.getByText("0 SELESAI · 1 TERKUNCI")).toBeTruthy();
  });

  it("unlock null (unreachable with valid data) falls back to the alt copy", () => {
    render(<LessonPage data={lockedDto(null)} />);
    expect(screen.queryByRole("link", { name: "Buka materi 1" })).toBeNull();
    // "Kembali ke Belajar" becomes the PRIMARY action, "Ke Beranda" the
    // alternative.
    expect(
      screen.getAllByRole("link", { name: "Kembali ke Belajar" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Ke Beranda" }).getAttribute("href"),
    ).toBe("/");
  });
});

describe("LessonPage — not-enrolled state", () => {
  it("shows the dashed panel wired to the h2, with no outline or beacon", async () => {
    render(<LessonPage data={NOT_ENROLLED_DTO} />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Anda belum mengikuti kursus ini",
      }),
    ).toBeTruthy();
    expect(screen.getByText("KURSUS · BELUM DIIKUTI")).toBeTruthy();
    expect(
      screen.getByText(
        "Mulai kursus untuk membuka materi dan menyimpan progress Anda.",
      ),
    ).toBeTruthy();

    const headingId = screen.getByRole("heading", {
      level: 2,
      name: "Anda belum mengikuti kursus ini",
    }).id;
    const start = screen.getByRole("button", { name: "Mulai materi 1" });
    expect(start.getAttribute("aria-describedby")).toBe(headingId);
    expect(
      screen
        .getByRole("link", { name: "Kembali ke Belajar" })
        .getAttribute("href"),
    ).toBe("/belajar");

    expect(
      screen.queryByRole("navigation", { name: "Daftar materi" }),
    ).toBeNull();
    expect(screen.queryByText("Isi materi uji S2-01.")).toBeNull();
    await actAsync();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** Flush the beacon's useEffect promise. */
async function actAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

// --- the video player (card S2-02 §6) ---------------------------------------
//
// The REAL LessonVideoPlayer + the REAL YouTube engine run here (no
// component mocks): placement above the h1, the no-video case, and the
// key-driven remount between lessons (review item 3 / mutation 10) with
// a FakePlayer double on window.YT — same pattern as the engine's own
// tests, fresh module registry per file.

type FakeConfig = {
  events?: {
    onReady?: () => void;
    onStateChange?: (event: { data: number }) => void;
    onError?: (event: { data: number }) => void;
  };
};

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
}

const YOUTUBE_PLAYBACK: PlaybackDTO = {
  kind: "youtube",
  videoId: "e2eVideo001",
  durationSeconds: 252,
};

function videoPosts(): Array<{ lessonId: string; positionSeconds: number }> {
  return fetchMock.mock.calls
    .filter(([url]) => url === "/api/progress/video")
    .map(([, init]) =>
      JSON.parse((init as RequestInit).body as string) as {
        lessonId: string;
        positionSeconds: number;
      },
    );
}

describe("LessonPage — video player (S2-02)", () => {
  beforeEach(() => {
    FakePlayer.instances = [];
    window.YT = { Player: FakePlayer } as unknown as Window["YT"];
  });

  it("no playback → no iframe anywhere on the page", () => {
    const view = render(<LessonPage data={openDto()} />);
    expect(view.container.querySelector("iframe")).toBeNull();
  });

  it("the player sits ABOVE the h1 in the main column", async () => {
    const view = render(<LessonPage data={openDto({ playback: YOUTUBE_PLAYBACK })} />);
    const frame = view.container.querySelector(".aspect-video");
    expect(frame).not.toBeNull();
    const h1 = screen.getByRole("heading", { level: 1 });
    // The frame PRECEDES the heading in document order (7d layout).
    expect(
      frame!.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await actAsync();
    expect(view.container.querySelector("iframe")).not.toBeNull();
  });

  it("moving to another lesson resets the player state via the key (mutation 10)", async () => {
    vi.useFakeTimers();
    try {
      const LESSON_ID_B = "1f0c2a34-2222-4222-8222-222222222222";
      // Material A: resumed at 84 s.
      const view = render(
        <LessonPage
          data={openDto({
            playback: YOUTUBE_PLAYBACK,
            progress: { videoLastPositionSeconds: 84, videoWatchedPercent: 33 },
          })}
        />,
      );
      window.onYouTubeIframeAPIReady?.();
      await actAsync();
      FakePlayer.last.ready();
      await actAsync();

      // Local state that ONLY a remount resets: dismiss the resume row.
      fireEvent.click(screen.getByRole("button", { name: "Mulai dari awal" }));
      expect(FakePlayer.last.seeks).toEqual([[0, true]]);
      expect(screen.queryByText(/Melanjutkan dari/)).toBeNull();

      // Material B: another lesson id, another video, position 84 again.
      view.rerender(
        <LessonPage
          data={openDto({
            lessonId: LESSON_ID_B,
            playback: { ...YOUTUBE_PLAYBACK, videoId: "e2eVideo002" },
            progress: { videoLastPositionSeconds: 84, videoWatchedPercent: 33 },
          })}
        />,
      );
      await actAsync();
      // The row is BACK — fresh instance, the click on A did not leak.
      expect(screen.getByText("Melanjutkan dari 01:24")).toBeTruthy();
      const src = view.container.querySelector("iframe")!.getAttribute("src")!;
      expect(src).toContain("e2eVideo002");
      expect(src).toContain("start=84");

      // And the NEXT progress POST belongs to lesson B, never A.
      FakePlayer.last.ready();
      await actAsync();
      FakePlayer.last.currentTime = 90;
      FakePlayer.last.duration = 100;
      FakePlayer.last.emit(1); // playing
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      const posts = videoPosts();
      expect(posts).toHaveLength(1);
      expect(posts[0]).toEqual({
        lessonId: LESSON_ID_B,
        positionSeconds: 90,
        durationSeconds: 100,
      });
      expect(posts.every((post) => post.lessonId !== LESSON_ID)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
