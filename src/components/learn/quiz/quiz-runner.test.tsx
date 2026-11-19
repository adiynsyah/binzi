// @vitest-environment jsdom
import "../../ui/test-env";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatNumberList,
  formatRemainingClock,
  QuizRunner,
} from "./quiz-runner";
import type { QuizRunningDTO } from "@/modules/attempt/service";

// Card S3-01 §4.B — the runner contract: header/timer/indicator, chip
// names + aria-current, focus on question change, PUT per pick, the
// summary gate, the 2-minute announcement, timer-zero → flush → collect →
// refresh, and the three 28c stages.

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

// Fixed server pair: 5 minutes on the clock at first paint.
const SERVER_NOW = Date.UTC(2026, 10, 18, 7, 0, 0);
const EXPIRES_AT = SERVER_NOW + 5 * 60_000;

function runningDto(overrides: Partial<QuizRunningDTO> = {}): QuizRunningDTO {
  return {
    state: "berjalan",
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SERVER_NOW);
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
  it("renders the header, timer landmark and save-free initial state", () => {
    render(<QuizRunner data={runningDto()} />);

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

  it("hydrates persisted answers without re-sending them (QZ-08)", () => {
    render(
      <QuizRunner data={runningDto({ answers: { [Q1]: Q1_OPTION_A } })} />,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole("button", { name: "Soal 1, sudah dijawab" }),
    ).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Opsi A" }).hasAttribute("checked")).toBe(true);
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

    fireEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(
      screen.getByRole("button", { name: "Sebelumnya", hidden: true }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lihat ringkasan" }));

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

  it("28c: indicator only below 10 s offline, banner above, recovery banner", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/answers/")) throw new TypeError("Failed to fetch");
      return okSubmit();
    });
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
    // Stage 2 (> 10 s): the error banner sticks above the runner.
    expect(
      screen.getByText("1 jawaban belum tersimpan di server"),
    ).toBeTruthy();
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

  it("shows the dashed unsaved chip style marker class while offline", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/answers/")) throw new TypeError("Failed to fetch");
      return okSubmit();
    });
    render(<QuizRunner data={runningDto()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Opsi A" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const chip = screen.getAllByRole("button", { name: "Soal 1, sudah dijawab" })[0]!;
    expect(chip.className).toContain("border-dashed");
  });
});
