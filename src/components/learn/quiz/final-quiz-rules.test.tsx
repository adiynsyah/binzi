// @vitest-environment jsdom
import "../../ui/test-env";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FinalQuizRules } from "./final-quiz-rules";
import type { FinalQuizRulesDTO } from "@/modules/attempt/service";

// Card S5-02 §4.A — the 7h-left copy (minus design annotations and the
// "Nilai Akhir ≥ 70" sentence — PRD §6.2 wins, decision 4), and the start
// flow through the shared useQuizStart: 201/200/409 → router.refresh,
// transport failure → the Banner (usulan copy).

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

const COURSE_ID = "2c3d4e5f-0000-4000-8000-0000000000aa";

function rulesDto(
  overrides: Partial<FinalQuizRulesDTO> = {},
): FinalQuizRulesDTO {
  return {
    state: "aturan-final",
    courseId: COURSE_ID,
    courseTitle: "Gizi Ibu Hamil T1",
    questionCount: 10,
    durationMinutes: 20,
    passingScorePercent: 70,
    lessonAveragePercent: 84,
    weights: { lessonPercent: 60, finalPercent: 40 },
    lastLessonHref: "/belajar/gizi-ibu-hamil/materi-8",
    ...overrides,
  };
}

function ok(created: boolean) {
  return new Response(
    JSON.stringify({
      data: {
        attemptId: "0b1f4a67-89ab-4cde-a012-222222222222",
        created,
      },
    }),
    { status: created ? 201 : 200 },
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  refreshMock.mockReset();
});

describe("FinalQuizRules", () => {
  it("renders the 7h copy — weights, average, passing rule", () => {
    render(<FinalQuizRules data={rulesDto()} />);

    expect(screen.getByText("FINAL QUIZ · Gizi Ibu Hamil T1")).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Final Quiz menentukan 40% Nilai Akhir",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/10 soal dari seluruh materi kursus/)).toBeTruthy();
    expect(screen.getByText("satu kesempatan")).toBeTruthy();

    // 7h (S3-02 §4): title, intro, rules and BOTH buttons sit in one
    // primary-tint box (line pair border-danger-tint-line); the eyebrow
    // stays outside it.
    const box = screen.getByRole("heading", { level: 1 }).closest("div")!;
    expect(box.className).toContain("bg-primary-tint");
    expect(box.className).toContain("border-danger-tint-line");
    expect(
      box.contains(
        screen.getByRole("button", { name: "Saya siap, mulai Final Quiz" }),
      ),
    ).toBe(true);
    expect(
      box.contains(screen.getByRole("link", { name: "Ulas materi dulu" })),
    ).toBe(true);
    expect(
      box.contains(screen.getByText("FINAL QUIZ · Gizi Ibu Hamil T1")),
    ).toBe(false);

    expect(screen.getByText("84")).toBeTruthy();
    expect(
      screen.getByText(/Rata-rata quiz materi Anda sekarang/),
    ).toBeTruthy();
    expect(screen.getByText(/bobot 60%/)).toBeTruthy();
    expect(screen.getByText("Waktu 20 menit")).toBeTruthy();
    expect(
      screen.getByText(
        /timer dihitung server dan terus berjalan meski tab ditutup; habis waktu berarti auto-submit/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Jawaban tersimpan otomatis tiap soal"),
    ).toBeTruthy();
    expect(
      screen.getByText("Lulus kursus bila nilai Final Quiz ≥ 70"),
    ).toBeTruthy();
  });

  it("renders “–” when the average is null (defensive)", () => {
    render(<FinalQuizRules data={rulesDto({ lessonAveragePercent: null })} />);
    expect(screen.getByText("–")).toBeTruthy();
    expect(screen.queryByText("84")).toBeNull();
  });

  it("links to the last lesson with the secondary style", () => {
    render(<FinalQuizRules data={rulesDto()} />);
    const back = screen.getByRole("link", { name: "Ulas materi dulu" });
    expect(back.getAttribute("href")).toBe("/belajar/gizi-ibu-hamil/materi-8");
  });

  it("POSTs the final attempt and refreshes on 201, holding loading", async () => {
    fetchMock.mockResolvedValue(ok(true));
    render(<FinalQuizRules data={rulesDto()} />);
    const button = screen.getByRole("button", {
      name: "Saya siap, mulai Final Quiz",
    });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `/api/quiz/courses/${COURSE_ID}/final-attempt`,
    );
    expect(fetchMock.mock.calls[0]![1]).toEqual({ method: "POST" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    // Loading stays on until the refreshed page lands (no re-tap).
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("refreshes on 409 (gate / already worked on) — the GET sorts it out", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "x" } }), {
        status: 409,
      }),
    );
    render(<FinalQuizRules data={rulesDto()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Saya siap, mulai Final Quiz" }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows the Banner on a network failure and returns focus to the button", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<FinalQuizRules data={rulesDto()} />);
    const button = screen.getByRole("button", {
      name: "Saya siap, mulai Final Quiz",
    });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(refreshMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Final Quiz belum dimulai. Periksa koneksi lalu coba lagi.",
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-busy")).toBe(null);
  });
});
