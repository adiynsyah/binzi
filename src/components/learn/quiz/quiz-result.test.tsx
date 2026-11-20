// @vitest-environment jsdom
import "../../ui/test-env";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatQuizDuration, QuizResult } from "./quiz-result";
import type { QuizResultDTO, QuizResultItemDTO } from "@/modules/attempt/service";

// Card S3-01 §4.C — the 7u copy, the stats row, the per-item review with
// the policy-gated key/explanation pair, and the closing actions.

const LESSON_HREF = "/belajar/gizi-ibu-hamil/asam-folat";

function item(overrides: Partial<QuizResultItemDTO> = {}): QuizResultItemDTO {
  return {
    number: 1,
    text: "Pertanyaan pertama?",
    type: "SINGLE_CHOICE",
    options: [
      { label: "A", text: "Opsi A", selected: false, correct: null },
      { label: "B", text: "Opsi B", selected: true, correct: true },
    ],
    explanation: "Karena opsi B memang benar.",
    ...overrides,
  };
}

function resultDto(overrides: Partial<QuizResultDTO> = {}): QuizResultDTO {
  return {
    state: "hasil",
    reviewAccess: "ALWAYS",
    status: "SUBMITTED",
    scorePercent: 80,
    isPassed: true,
    correct: 4,
    wrong: 1,
    unanswered: 0,
    durationSeconds: 192,
    items: [item()],
    lesson: { position: 2, title: "Asam Folat & Zat Besi", href: LESSON_HREF },
    next: { position: 3, href: "/belajar/gizi-ibu-hamil/materi-ketiga" },
    finalQuizHref: null,
    finalQuizDone: false,
    ...overrides,
  };
}

describe("formatQuizDuration", () => {
  it("formats like 7u's “3m 12d”", () => {
    expect(formatQuizDuration(192)).toBe("3m 12d");
    expect(formatQuizDuration(0)).toBe("0m 00d");
    expect(formatQuizDuration(5)).toBe("0m 05d");
    expect(formatQuizDuration(60)).toBe("1m 00d");
    // No hours unit is invented — an hour-plus quiz stays in minutes.
    expect(formatQuizDuration(3_661)).toBe("61m 01d");
    expect(formatQuizDuration(-3)).toBe("0m 00d");
  });
});

describe("QuizResult", () => {
  it("renders the eyebrow, pill, score card and stats", () => {
    render(
      <QuizResult data={resultDto({ correct: 1, wrong: 0 })} />,
    );

    expect(screen.getByText("Materi 2 · Hasil Quiz")).toBeTruthy();
    expect(screen.getByText("Terkunci permanen")).toBeTruthy();
    expect(screen.getByText("80")).toBeTruthy();
    expect(screen.getByText("Nilai")).toBeTruthy();
    expect(screen.getByText("Lulus")).toBeTruthy();
    expect(screen.getByText("1/1")).toBeTruthy();
    expect(screen.getByText("benar")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("salah")).toBeTruthy();
    expect(screen.getByText("3m 12d")).toBeTruthy();
    expect(screen.getByText("waktu")).toBeTruthy();
    expect(
      screen.getByText(
        "Ditampilkan untuk semua soal, apa pun nilainya — karena tidak ada percobaan kedua.",
      ),
    ).toBeTruthy();
  });

  it("adds the unanswered stat only when there is one", () => {
    const { rerender } = render(<QuizResult data={resultDto()} />);
    expect(screen.queryByText("tidak dijawab")).toBeNull();

    rerender(<QuizResult data={resultDto({ unanswered: 2 })} />);
    expect(screen.getByText("tidak dijawab")).toBeTruthy();
  });

  it("marks a failed attempt and shows the EXPIRED line", () => {
    render(
      <QuizResult
        data={resultDto({ status: "EXPIRED", isPassed: false, scorePercent: 29 })}
      />,
    );
    expect(screen.getByText("Belum lulus")).toBeTruthy();
    expect(screen.getByText("29")).toBeTruthy();
    expect(
      screen.getByText(
        "Waktu habis — jawaban yang sudah tersimpan dikumpulkan otomatis.",
      ),
    ).toBeTruthy();
  });

  it("reviews a wrong answer with Kunci and the explanation", () => {
    render(
      <QuizResult
        data={resultDto({
          items: [
            item({
              number: 2,
              options: [
                { label: "A", text: "Opsi A", selected: true, correct: false },
                { label: "B", text: "Opsi B", selected: false, correct: true },
              ],
            }),
          ],
        })}
      />,
    );

    const article = screen.getByRole("article");
    expect(screen.getByText("Soal 2")).toBeTruthy();
    expect(within(article).getByText("Salah")).toBeTruthy();
    expect(within(article).getByText("Jawaban Anda: Opsi A")).toBeTruthy();
    expect(within(article).getByText("Kunci:")).toBeTruthy();
    expect(within(article).getByText("Opsi B")).toBeTruthy();
    expect(screen.getByText("Karena opsi B memang benar.")).toBeTruthy();
  });

  it("shows no Kunci for a correct answer", () => {
    render(<QuizResult data={resultDto()} />);
    expect(within(screen.getByRole("article")).getByText("Benar")).toBeTruthy();
    expect(screen.queryByText(/^Kunci:/)).toBeNull();
  });

  it("hides Kunci AND explanation together behind the policy (null correct)", () => {
    render(
      <QuizResult
        data={resultDto({
          items: [
            item({
              options: [
                { label: "A", text: "Opsi A", selected: true, correct: null },
                { label: "B", text: "Opsi B", selected: false, correct: null },
              ],
              explanation: null,
            }),
          ],
        })}
      />,
    );
    expect(within(screen.getByRole("article")).getByText("Salah")).toBeTruthy();
    expect(screen.queryByText(/^Kunci:/)).toBeNull();
    expect(screen.queryByText("Karena opsi B memang benar.")).toBeNull();
  });

  it("says “tidak dijawab” for an unanswered question", () => {
    render(
      <QuizResult
        data={resultDto({
          items: [
            item({
              options: [
                { label: "A", text: "Opsi A", selected: false, correct: true },
                { label: "B", text: "Opsi B", selected: false, correct: false },
              ],
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("tidak dijawab")).toBeTruthy();
    expect(screen.getByText("Kunci:")).toBeTruthy();
    expect(screen.getByText("Opsi A")).toBeTruthy();
  });

  it("closes with the next-lesson unlock when there is one", () => {
    render(<QuizResult data={resultDto()} />);
    expect(
      screen.getByText("Materi 2 ditandai selesai. Materi 3 sekarang terbuka."),
    ).toBeTruthy();
    const next = screen.getByRole("link", { name: "Lanjut ke Materi 3" });
    expect(next.getAttribute("href")).toBe("/belajar/gizi-ibu-hamil/materi-ketiga");
    const back = screen.getByRole("link", { name: "Kembali ke materi" });
    expect(back.getAttribute("href")).toBe(LESSON_HREF);
  });

  it("closes without the next link on the last lesson", () => {
    render(<QuizResult data={resultDto({ next: null })} />);
    expect(screen.getByText("Materi 2 ditandai selesai.")).toBeTruthy();
    expect(screen.queryByText(/sekarang terbuka/)).toBeNull();
    expect(screen.queryByRole("link", { name: /^Lanjut ke Materi/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Kembali ke materi" })).toBeTruthy();
  });

  it("closes with the Final Quiz opening when every lesson is complete", () => {
    // finalQuizHref REPLACES the next-lesson branch — even though the
    // fixture's data.next still points at materi 3 (card S5-02 §5).
    render(
      <QuizResult
        data={resultDto({
          finalQuizHref: "/belajar/gizi-ibu-hamil/final-quiz",
        })}
      />,
    );
    expect(
      screen.getByText("Materi 2 ditandai selesai. Final Quiz sekarang terbuka."),
    ).toBeTruthy();
    const final = screen.getByRole("link", { name: "Lanjut ke Final Quiz" });
    expect(final.getAttribute("href")).toBe(
      "/belajar/gizi-ibu-hamil/final-quiz",
    );
    expect(
      screen.queryByRole("link", { name: /^Lanjut ke Materi/ }),
    ).toBeNull();
    expect(screen.getByRole("link", { name: "Kembali ke materi" })).toBeTruthy();
  });
});
