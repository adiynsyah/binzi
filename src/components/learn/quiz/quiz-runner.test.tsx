// @vitest-environment jsdom
import "../../ui/test-env";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatNumberList,
  formatRemainingClock,
  QuizRunner,
} from "./quiz-runner";
import type { QuizRunningDTO } from "@/modules/attempt/service";

// Card S3-01 §4.B + perapian S3-02 §1 — the runner contract: page h1,
// header/timer/indicator, chip names + aria-current, focus on question
// change, PUT per pick, the summary gate (exactly ONE navigator), the
// 2-minute announcement, timer-zero → flush → collect → refresh, the
// three 28c stages (stage 2 aged on the DEVICE clock), re-entry landing
// on the first unanswered question, and the inline collect-failure
// banner with its focus/retry contract.

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
const Q1 = "11111111-2222-4333-8444-555555555555";
const Q2 = "11111111-2222-4333-8444-666666666666";
const Q1_OPTION_A = "aaaaaaaa-2222-4333-8444-555555555555";
const Q1_OPTION_B = "bbbbbbbb-2222-4333-8444-555555555555";
const COLLECT_FAILED_MESSAGE =
  "Jawaban belum terkumpulkan. Periksa koneksi lalu coba lagi.";

// Fixed server pair: 5 minutes on the clock at first paint. The device
// clock starts AT SERVER_NOW (vi.setSystemTime) — the ±60 s skew tests
// below shift only the DTO's pair.
const SERVER_NOW = Date.UTC(2026, 10, 18, 7, 0, 0);
const EXPIRES_AT = SERVER_NOW + 5 * 60_000;

function runningDto(overrides: Partial<QuizRunningDTO> = {}): QuizRunningDTO {
  return {
    state: "berjalan",
    heading: "Quiz Materi 2 · Asam Folat & Zat Besi",
    attemptId: ATTEMPT_ID,
    expiresAt: new Date(EXPIRES_AT).toISOString(),
    serverNow: new Date(SERVER_NOW).toISOString(),
    questions: [
      {
        id: Q1,
        number: 1,
        text: "Pertanyaan pertama?",
        type: "SINGLE_CHOICE",
        options: [
          { id: Q1_OPTION_A, label: "A", text: "Opsi A" },
          { id: Q1_OPTION_B, label: "B", text: "Opsi B" },
        ],
      },
      {
        id: Q2,
        number: 2,
        text: "Pertanyaan kedua?",
        type: "TRUE_FALSE",
        options: [
          { id: "cccccccc-2222-4333-8444-555555555555", label: "A", text: "Benar" },
          { id: "dddddddd-2222-4333-8444-555555555555", label: "B", text: "Salah" },
        ],
      },
    ],
    answers: {},
    ...overrides,
  };
}

/** 4-question fixture for the re-entry index tests (numbers 1–4). */
function fourQuestionDto(answers: Record<string, string>): QuizRunningDTO {
  return runningDto({
    questions: [1, 2, 3, 4].map((n) => ({
      id: `q${n}`,
      number: n,
      text: `Teks soal ${n}`,
      type: "SINGLE_CHOICE" as const,
      options: [{ id: `o${n}`, label: "A", text: `Opsi ${n}` }],
    })),
    answers,
  });
}

function okSave(): Response {
  return new Response(
    JSON.stringify({ data: { savedAt: "2026-11-18T07:00:01.000Z" } }),
    { status: 200 },
  );
}

function okSubmit(): Response {
  return new Response(JSON.stringify({ data: { status: "SUBMITTED" } }), {
    status: 200,
  });
}

function failedSubmit(): Response {
  return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
}

/** Answers PUTs fail like a dropped connection; submit follows `submit`. */
function offlineAnswersMock(submit: () => Response | Promise<Response>) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    if (String(input).includes("/answers/")) throw new TypeError("Failed to fetch");
    return submit();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SERVER_NOW);
  // jsdom does not implement scrollIntoView; the collect-fail focus
  // effect calls it.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  fetchMock.mockReset();
  refreshMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(`/attempts/${ATTEMPT_ID}/answers/`)) return okSave();
    if (url.endsWith("/submit")) return okSubmit();
    return new Response("{}", { status: 404 });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRemainingClock", () => {
  it("formats mm:ss, ceiling partial seconds", () => {
    expect(formatRemainingClock(5 * 60_000)).toBe("05:00");
    expect(formatRemainingClock(192_400)).toBe("03:13");
    expect(formatRemainingClock(1)).toBe("00:01");
    expect(formatRemainingClock(0)).toBe("00:00");
    expect(formatRemainingClock(-5_000)).toBe("00:00");
  });
});

describe("formatNumberList", () => {
  it("joins like 28c's “soal 3 & 4”", () => {
    expect(formatNumberList([3])).toBe("3");
    expect(formatNumberList([3, 4])).toBe("3 & 4");
    expect(formatNumberList([1, 2, 3])).toBe("1, 2 & 3");
  });
});

describe("QuizRunner", () => {
  it("renders the h1, header, timer landmark and save-free initial state", () => {
    render(<QuizRunner data={runningDto()} />);

    // The DTO heading is the page's single h1 (S3-02 §1).
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Quiz Materi 2 · Asam Folat & Zat Besi");
    // No answers → re-entry index 0 → Soal 1.
    expect(screen.getByText("Soal 1 dari 2 · Satu kesempatan")).toBeTruthy();
    const timer = screen.getByRole("timer");
    expect(timer.getAttribute("aria-label")).toBe("Sisa waktu");
    expect(timer.textContent).toBe("05:00");
    expect(screen.getByRole("heading", { level: 2, name: "Pertanyaan pertama?" })).toBeTruthy();
    // No answer yet → no indicator (nothing to report).
    expect(screen.queryByText("tersimpan otomatis")).toBeNull();
  });

  it("exposes chip names with answered/ragu state and aria-current", () => {
    render(<QuizRunner data={runningDto()} />);

    // The navigator renders twice (mobile row + ≥1024 aside) with ONE
    // shared contract — every instance must agree.
    const chip1 = screen.getAllByRole("button", { name: "Soal 1, belum dijawab" });
    expect(chip1).toHaveLength(2);
    for (const chip of chip1) {
      expect(chip.getAttribute("aria-current")).toBe("true");
    }
    for (const chip of screen.getAllByRole("button", { name: "Soal 2, belum dijawab" })) {
      expect(chip.getAttribute("aria-current")).toBe(null);
    }

    fireEvent.click(screen.getByRole("radio", { name: "Opsi A" }));
    expect(
      screen.getAllByRole("button", { name: "Soal 1, sudah dijawab" }),
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Tandai ragu-ragu" }));
    expect(
      screen.getAllByRole("button", { name: "Soal 1, sudah dijawab, ditandai ragu" }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Tandai ragu-ragu" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("PUTs the pick and reports “tersimpan otomatis” once confirmed", async () => {
    render(<QuizRunner data={runningDto()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Opsi B" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`/api/quiz/attempts/${ATTEMPT_ID}/answers/${Q1}`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ optionId: Q1_OPTION_B });

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("tersimpan otomatis")).toBeTruthy();
  });

  it("hydrates persisted answers without re-sending them — landing on the first unanswered (QZ-08)", () => {
    render(
      <QuizRunner data={runningDto({ answers: { [Q1]: Q1_OPTION_A } })} />,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    // Q1 answered → re-entry lands on Soal 2, not Soal 1.
    expect(screen.getByText("Soal 2 dari 2 · Satu kesempatan")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Pertanyaan kedua?" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Soal 1, sudah dijawab" }),
    ).toHaveLength(2);

    // Walking back shows the persisted pick checked.
    fireEvent.click(screen.getByRole("button", { name: "Sebelumnya" }));
    expect(screen.getByRole("radio", { name: "Opsi A" }).hasAttribute("checked")).toBe(true);
  });

  it("re-entry index: gap answers (1, 2, 4) land on Soal 3, not Soal 3-by-count", () => {
    render(<QuizRunner data={fourQuestionDto({ q1: "o1", q2: "o2", q4: "o4" })} />);
    expect(screen.getByText("Soal 3 dari 4 · Satu kesempatan")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Teks soal 3" }),
    ).toBeTruthy();
  });

  it("re-entry index: answers 1–3 land on Soal 4", () => {
    render(<QuizRunner data={fourQuestionDto({ q1: "o1", q2: "o2", q3: "o3" })} />);
    expect(screen.getByText("Soal 4 dari 4 · Satu kesempatan")).toBeTruthy();
  });

  it("re-entry index: all answered → the last question", () => {
    render(
      <QuizRunner data={fourQuestionDto({ q1: "o1", q2: "o2", q3: "o3", q4: "o4" })} />,
    );
    expect(screen.getByText("Soal 4 dari 4 · Satu kesempatan")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Lihat ringkasan" }),
    ).toBeTruthy();
  });

  it("moves focus to the question heading on every change", () => {
    render(<QuizRunner data={runningDto()} />);

    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    const heading = screen.getByRole("heading", { level: 2, name: "Pertanyaan kedua?" });
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
  });

  it("navigates: Sebelumnya disabled on q1, last question offers the summary", () => {
    render(<QuizRunner data={runningDto()} />);

    const prev = screen.getByRole("button", { name: "Sebelumnya" });
    expect((prev as HTMLButtonElement).disabled).toBe(true);

    // Forward is the pair's visual primary — dark at the md band (7u),
    // never the 52px lg band.
    const next = screen.getByRole("button", { name: "Berikutnya" });
    expect(next.className).toContain("bg-text");
    expect(next.className).not.toContain("bg-primary-deep");

    fireEvent.click(next);
    expect(
      screen.getByRole("button", { name: "Sebelumnya", hidden: true }),
    ).toBeTruthy();
    const summary = screen.getByRole("button", { name: "Lihat ringkasan" });
    expect(summary.className).toContain("bg-text");
    fireEvent.click(summary);

    expect(
      screen.getByRole("heading", { level: 2, name: "Ringkasan sebelum dikumpulkan" }),
    ).toBeTruthy();
    expect(screen.getByText("0 dijawab · 2 belum dijawab · 0 ragu-ragu")).toBeTruthy();
    expect(
      screen.getByText("2 soal belum dijawab dan akan dinilai salah."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Kembali ke soal" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Kumpulkan sekarang" }),
    ).toBeTruthy();
  });

  it("ringkasan renders exactly ONE Navigator group (7u/S3-02 §1)", () => {
    render(<QuizRunner data={runningDto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat ringkasan" }));

    const navigators = screen.getAllByRole("group", { name: "Navigator soal" });
    expect(navigators).toHaveLength(1);
    expect(
      within(navigators[0]!).getByRole("button", { name: "Soal 1, belum dijawab" }),
    ).toBeTruthy();
  });

  it("collects: POST submit → refresh, holding loading", async () => {
    render(<QuizRunner data={runningDto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat ringkasan" }));
    fireEvent.click(screen.getByRole("button", { name: "Kumpulkan sekarang" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`/api/quiz/attempts/${ATTEMPT_ID}/submit`);
    expect(init.method).toBe("POST");
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Mengumpulkan…" }).getAttribute("aria-busy"),
    ).toBe("true");
  });

  it("collect failure in ringkasan → inline banner below the button row, focused; retry re-POSTs", async () => {
    offlineAnswersMock(() => failedSubmit());
    render(<QuizRunner data={runningDto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat ringkasan" }));
    fireEvent.click(screen.getByRole("button", { name: "Kumpulkan sekarang" }));
    await act(async () => {
      await Promise.resolve();
    });

    const banner = screen.getByText(COLLECT_FAILED_MESSAGE).closest('[role="alert"]')!;
    expect(banner).toBeTruthy();
    // Its OWN row below the button row — not inside the right-aligned
    // button column.
    const collect = screen.getByRole("button", { name: "Kumpulkan sekarang" });
    expect(
      (collect.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
    // Focus moved into the banner's wrapper (keyboard users learn the
    // miss) — the wrapper carries tabIndex={-1} around the alert.
    expect(document.activeElement?.textContent).toContain(COLLECT_FAILED_MESSAGE);

    fireEvent.click(screen.getByRole("button", { name: "Coba kumpulkan lagi" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/submit")),
    ).toHaveLength(2);
  });

  it("a second collect failure remounts the banner and moves focus again", async () => {
    offlineAnswersMock(() => failedSubmit());
    render(<QuizRunner data={runningDto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat ringkasan" }));
    fireEvent.click(screen.getByRole("button", { name: "Kumpulkan sekarang" }));
    await act(async () => {
      await Promise.resolve();
    });
    const firstBanner = screen.getByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Coba kumpulkan lagi" }));
    await act(async () => {
      await Promise.resolve();
    });

    // `key` remount → a fresh alert node (re-announced), focus moved in.
    const secondBanner = screen.getByRole("alert");
    expect(secondBanner).not.toBe(firstBanner);
    expect(document.activeElement?.textContent).toContain(COLLECT_FAILED_MESSAGE);
    expect(screen.getByText(COLLECT_FAILED_MESSAGE)).toBeTruthy();
  });

  it("soft-disables collect while an answer is unsaved, with the wait line", async () => {
    let resolveSave!: (response: Response) => void;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL) =>
        new Promise<Response>((resolve) => {
          if (String(input).includes("/answers/")) {
            resolveSave = resolve;
          } else {
            resolve(okSubmit());
          }
        }),
    );
    render(<QuizRunner data={runningDto()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Opsi A" }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Lihat ringkasan" }));

    const collect = screen.getByRole("button", { name: "Kumpulkan sekarang" });
    expect(collect.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Tunggu, jawaban sedang disimpan…")).toBeTruthy();

    // The handler guard blocks the click too (softDisabled stays focusable).
    fireEvent.click(collect);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/submit"))).toHaveLength(0);

    await act(async () => {
      resolveSave(okSave());
      await Promise.resolve();
    });
    expect(collect.getAttribute("aria-disabled")).toBe(null);
    expect(screen.queryByText("Tunggu, jawaban sedang disimpan…")).toBeNull();
  });

  it("announces “Sisa waktu 2 menit.” once and turns the timer danger", async () => {
    render(<QuizRunner data={runningDto()} />);
    // The announcement region exists but is empty (C-08: no layout shift).
    const live = document.querySelector("p[aria-live='polite']")!;
    expect(live.textContent).toBe("");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000 + 1_000);
    });
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("Sisa waktu 2 menit.");

    const timer = screen.getByRole("timer");
    expect(timer.className).toContain("text-danger");
    expect(timer.textContent).toBe("01:59");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    // One announcement, not one per tick.
    expect(screen.getAllByText("Sisa waktu 2 menit.")).toHaveLength(1);
  });

  it("at zero: flush pending, POST submit, refresh (server-clock timer)", async () => {
    render(<QuizRunner data={runningDto()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Opsi A" }));
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 2_000);
    });

    expect(screen.getByText("Waktu habis — mengumpulkan jawaban…")).toBeTruthy();
    const submitCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/submit"),
    );
    expect(submitCalls).toHaveLength(1);
    expect(submitCalls[0]![1]).toEqual({ method: "POST" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("expired state collect failure → inline banner; Coba kumpulkan lagi re-POSTs", async () => {
    offlineAnswersMock(() => failedSubmit());
    render(<QuizRunner data={runningDto()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 2_000);
    });

    expect(screen.getByText("Waktu habis — mengumpulkan jawaban…")).toBeTruthy();
    expect(screen.getByText(COLLECT_FAILED_MESSAGE)).toBeTruthy();
    expect(document.activeElement?.textContent).toContain(COLLECT_FAILED_MESSAGE);

    fireEvent.click(screen.getByRole("button", { name: "Coba kumpulkan lagi" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/submit")),
    ).toHaveLength(2);
  });

  it("28c: indicator only below 10 s offline, sticky banner above, recovery banner", async () => {
    offlineAnswersMock(() => okSubmit());
    render(<QuizRunner data={runningDto()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Opsi A" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Stage 1 (< 10 s): indicator only, no banner.
    expect(screen.getByText("belum terkirim")).toBeTruthy();
    expect(screen.queryByText(/belum tersimpan di server/)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_001);
    });
    // Stage 2 (> 10 s): the error banner sticks below the header
    // (top-[69px] sm:top-[81px] — header height + border-b).
    expect(
      screen.getByText("1 jawaban belum tersimpan di server"),
    ).toBeTruthy();
    const offline = screen.getByRole("alert");
    expect(offline.className).toContain("sticky");
    expect(offline.className).toContain("top-[69px]");
    expect(
      screen.getByText(
        "Koneksi terputus. Jawaban soal 1 disimpan sementara di perangkat ini dan dikirim otomatis begitu tersambung. Jangan tutup atau muat ulang halaman ini.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Coba kirim sekarang" }),
    ).toBeTruthy();

    // “Coba kirim sekarang” + a healed connection → stage 3.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/answers/")) return okSave();
      return okSubmit();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Coba kirim sekarang" }));
      await Promise.resolve();
    });
    expect(
      screen.getByText("Tersambung. Jawaban soal 1 sudah tersimpan."),
    ).toBeTruthy();
    expect(screen.queryByText(/belum tersimpan di server/)).toBeNull();
  });

  it("stage 2 ages on the DEVICE clock — a 60 s FAST server clock must not trip it early", async () => {
    offlineAnswersMock(() => okSubmit());
    // Server pair shifted +60 s: the timer (server domain) still counts
    // 05:00 → …, but failingSince is a device-side stamp.
    render(
      <QuizRunner
        data={runningDto({
          serverNow: new Date(SERVER_NOW + 60_000).toISOString(),
          expiresAt: new Date(SERVER_NOW + 60_000 + 5 * 60_000).toISOString(),
        })}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Opsi A" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    // ~2 device seconds since the failure — no banner yet, even though a
    // server-domain comparison would read ~62 s.
    expect(screen.queryByText(/belum tersimpan di server/)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(
      screen.getByText("1 jawaban belum tersimpan di server"),
    ).toBeTruthy();
    // The timer itself IS server-clock: 11 s of device time elapsed →
    // 11 s off the countdown.
    expect(screen.getByRole("timer").textContent).toBe("04:49");
  });

  it("stage 2 lands on time when the server clock runs 60 s SLOW", async () => {
    offlineAnswersMock(() => okSubmit());
    render(
      <QuizRunner
        data={runningDto({
          serverNow: new Date(SERVER_NOW - 60_000).toISOString(),
          expiresAt: new Date(SERVER_NOW - 60_000 + 5 * 60_000).toISOString(),
        })}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Opsi A" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_001);
    });
    // A server-domain comparison would read −49 s and never arm the
    // banner; the device clock fires it right at 10 s.
    expect(
      screen.getByText("1 jawaban belum tersimpan di server"),
    ).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("04:49");
  });

  it("styles the unsaved chip danger-on-light, and unsaved outranks the ragu tint", async () => {
    offlineAnswersMock(() => okSubmit());
    render(<QuizRunner data={runningDto()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Opsi A" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const chip = screen.getAllByRole("button", { name: "Soal 1, sudah dijawab" })[0]!;
    expect(chip.className).toContain("border-dashed");
    expect(chip.className).toContain("border-danger");
    expect(chip.className).toContain("bg-surface");
    expect(chip.className).toContain("text-danger");

    // Flag it too: the name gains “ditandai ragu”, but the chip KEEPS
    // the unsaved look — unsaved is the more severe state (S3-02 §1).
    fireEvent.click(screen.getByRole("button", { name: "Tandai ragu-ragu" }));
    const flagged = screen.getAllByRole("button", {
      name: "Soal 1, sudah dijawab, ditandai ragu",
    })[0]!;
    expect(flagged.className).toContain("border-dashed");
    expect(flagged.className).toContain("bg-surface");
    expect(flagged.className).toContain("text-danger");
    expect(flagged.className).not.toContain("bg-warning-tint");
  });
});
