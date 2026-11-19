// @vitest-environment jsdom
import "../../ui/test-env";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuizRules } from "./quiz-rules";
import type { QuizRulesDTO } from "@/modules/attempt/service";

// Card S3-01 §4.A — 7e copy verbatim (minus design annotations), the
// "pilihan ganda" gate, and the start flow: 201/200/409 → router.refresh,
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

const LESSON_ID = "1e2d3c4b-0000-4000-8000-000000000001";

function rulesDto(
  overrides: Partial<QuizRulesDTO> = {},
): QuizRulesDTO {
  return {
    state: "aturan",
    lessonId: LESSON_ID,
    quizTitle: "Quiz Materi 2",
    lessonPosition: 2,
    lessonTitle: "Asam Folat & Zat Besi",
    questionCount: 3,
    durationMinutes: 15,
    passingScorePercent: 70,
    explanationPolicy: "ALWAYS",
    allSingleChoice: true,
    lessonHref: "/belajar/gizi-ibu-hamil/asam-folat",
    ...overrides,
  };
}

function ok(created: boolean) {
  return new Response(
    JSON.stringify({
      data: {
        attemptId: "0b1f4a67-89ab-4cde-a012-111111111111",
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

describe("QuizRules", () => {
  it("renders the 7e copy without design annotations", () => {
    render(<QuizRules data={rulesDto()} />);

    expect(
      screen.getByText("Quiz Materi 2 · Asam Folat & Zat Besi"),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Aturan quiz sebelum timer jalan" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Anda sudah menyetujui ketentuan satu kesempatan di layar materi. Halaman ini merangkum cara kerja quiz-nya sebelum waktu mulai berjalan.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("3 soal pilihan ganda · waktu 15 menit")).toBeTruthy();
    expect(
      screen.getByText(
        "Timer berjalan terus meski halaman ditutup — dihitung dari server, bukan dari perangkat Anda",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Habis waktu = jawaban yang sudah terisi otomatis dikumpulkan"),
    ).toBeTruthy();
    expect(screen.getByText("Jawaban tersimpan otomatis tiap soal")).toBeTruthy();
    expect(
      screen.getByText("Pembahasan lengkap muncul setelah dikumpulkan"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Lulus di nilai ≥ 70 — tidak lulus pun materi tetap tercatat selesai",
      ),
    ).toBeTruthy();
    expect(screen.getByText("15:00")).toBeTruthy();
    expect(
      screen.getByText(
        "Timer baru mulai setelah Anda menekan tombol di bawah. Menekan “Nanti saja” tidak membuat attempt apa pun.",
      ),
    ).toBeTruthy();
  });

  it("drops “pilihan ganda” when any question is not single choice", () => {
    render(<QuizRules data={rulesDto({ allSingleChoice: false })} />);
    expect(screen.getByText("3 soal · waktu 15 menit")).toBeTruthy();
    expect(screen.queryByText(/pilihan ganda/)).toBeNull();
  });

  it("links back to the lesson with the secondary style", () => {
    render(<QuizRules data={rulesDto()} />);
    const back = screen.getByRole("link", {
      name: "Nanti saja, kembali ke materi",
    });
    expect(back.getAttribute("href")).toBe(
      "/belajar/gizi-ibu-hamil/asam-folat",
    );
  });

  it("POSTs the attempt and refreshes on 201, holding loading", async () => {
    fetchMock.mockResolvedValue(ok(true));
    render(<QuizRules data={rulesDto()} />);
    const button = screen.getByRole("button", { name: "Saya paham, mulai quiz" });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `/api/quiz/lessons/${LESSON_ID}/attempt`,
    );
    expect(fetchMock.mock.calls[0]![1]).toEqual({ method: "POST" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    // Loading stays on until the refreshed page lands (no re-tap).
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("refreshes on 200 (resumed attempt) too", async () => {
    fetchMock.mockResolvedValue(ok(false));
    render(<QuizRules data={rulesDto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Saya paham, mulai quiz" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes on 409 (finalized / video gate) — the GET sorts it out", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "x" } }), { status: 409 }),
    );
    render(<QuizRules data={rulesDto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Saya paham, mulai quiz" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows the Banner on a network failure and returns focus to the button", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<QuizRules data={rulesDto()} />);
    const button = screen.getByRole("button", { name: "Saya paham, mulai quiz" });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(refreshMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Quiz belum dimulai. Periksa koneksi lalu coba lagi."),
    ).toBeTruthy();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-busy")).toBe(null);
  });
});
