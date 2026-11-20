// @vitest-environment jsdom
import "../../ui/test-env";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinalQuizResult, formatFinalClock } from "./final-quiz-result";
import type {
  FinalQuizResultDTO,
  QuizResultItemDTO,
} from "@/modules/attempt/service";

// Card S5-02 §4.D + perapian S3-02 §3 — the 7h-right copy: the score
// card with the course verdict ("Lulus kursus" = the Final Quiz's own
// is_passed, decision 4; solid success pill per 7h), the stored Nilai
// Akhir with its formula (success color only while Lulus), and the
// S3-01 review items below the fold with the shared reviewAccess gating.

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

function finalDto(
  overrides: Partial<FinalQuizResultDTO> = {},
  final: Partial<FinalQuizResultDTO["final"]> = {},
): FinalQuizResultDTO {
  return {
    state: "hasil-final",
    reviewAccess: "ALWAYS",
    status: "SUBMITTED",
    scorePercent: 80,
    isPassed: true,
    correct: 4,
    wrong: 1,
    unanswered: 0,
    durationSeconds: 866,
    items: [item()],
    final: {
      durationLimitSeconds: 1200,
      passingScorePercent: 70,
      lessonAveragePercent: 60,
      weights: { lessonPercent: 60, finalPercent: 40 },
      finalScorePercent: 68,
      courseStatus: "PASSED",
      ...final,
    },
    ...overrides,
  };
}

describe("formatFinalClock", () => {
  it("formats mm:ss zero-padded on both sides", () => {
    expect(formatFinalClock(0)).toBe("00:00");
    expect(formatFinalClock(5)).toBe("00:05");
    expect(formatFinalClock(65)).toBe("01:05");
    expect(formatFinalClock(866)).toBe("14:26");
    expect(formatFinalClock(1200)).toBe("20:00");
    expect(formatFinalClock(-3)).toBe("00:00");
  });
});

describe("FinalQuizResult", () => {
  it("renders exactly one h1 — the eyebrow itself", () => {
    render(<FinalQuizResult data={finalDto()} />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s.length).toBe(1);
    expect(h1s[0]!.textContent).toBe("FINAL QUIZ · HASIL");
    expect(screen.getByText("Terkunci permanen")).toBeTruthy();
  });

  it("renders the score card: value, SOLID course verdict, stats line", () => {
    render(<FinalQuizResult data={finalDto({ correct: 1 })} />);
    expect(screen.getByText("80")).toBeTruthy();
    // 7h (S3-02 §3): the passing pill is solid success, not the tint.
    const pill = screen.getByText("Lulus kursus");
    expect(pill.className).toContain("bg-success text-surface");
    expect(pill.className).not.toContain("bg-success-tint");
    expect(
      screen.getByText(
        "1 dari 1 soal benar · waktu pengerjaan 14:26 dari 20:00",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Nilai Final Quiz sudah tercatat permanen."),
    ).toBeTruthy();
  });

  it("adds the EXPIRED line for a time-out attempt", () => {
    render(
      <FinalQuizResult
        data={finalDto({
          status: "EXPIRED",
          isPassed: false,
          scorePercent: 29,
        })}
      />,
    );
    expect(screen.getByText("Belum lulus")).toBeTruthy();
    expect(
      screen.getByText(
        "Waktu habis — jawaban yang sudah tersimpan dikumpulkan otomatis.",
      ),
    ).toBeTruthy();
  });

  it("renders the stored Nilai Akhir with its formula", () => {
    render(<FinalQuizResult data={finalDto()} />);
    expect(
      screen.getByRole("heading", { name: "Nilai Akhir Kursus" }),
    ).toBeTruthy();
    expect(screen.getByText("68")).toBeTruthy();
    expect(screen.getByText("= 60 × 60%")).toBeTruthy();
    expect(screen.getByText("+ 80 × 40%")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Nilai Akhir kursus" });
    expect(bar.getAttribute("aria-valuenow")).toBe("68");
    // 7h (S3-02 §3): the big number wears success only while the course
    // verdict is Lulus.
    expect(screen.getByText("68").className).toContain("text-success");
  });

  // The status words are bold, so the sentence is split across text nodes —
  // assert on the <p>'s full textContent instead of one text node.
  function statusLine(text: string) {
    return (_: string, element: Element | null) =>
      element !== null &&
      element.tagName === "P" &&
      element.textContent === text;
  }

  it("words the PASSED status line", () => {
    render(<FinalQuizResult data={finalDto()} />);
    expect(
      screen.getByText(
        statusLine(
          "Status kursus: Lulus — nilai Final Quiz mencapai batas 70.",
        ),
      ),
    ).toBeTruthy();
  });

  it("words the COMPLETED status line and swaps the pill", () => {
    render(
      <FinalQuizResult
        data={finalDto(
          { isPassed: false, scorePercent: 60 },
          { courseStatus: "COMPLETED", finalScorePercent: 69 },
        )}
      />,
    );
    expect(screen.getByText("Belum lulus")).toBeTruthy();
    expect(screen.getByText("69")).toBeTruthy();
    // Selesai → the Nilai Akhir number drops the success color.
    expect(screen.getByText("69").className).not.toContain("text-success");
    expect(
      screen.getByText(
        statusLine(
          "Status kursus: Selesai — nilai Final Quiz di bawah batas 70. Nilai ini tetap tercatat.",
        ),
      ),
    ).toBeTruthy();
  });

  it("links to #pembahasan and /belajar", () => {
    render(<FinalQuizResult data={finalDto()} />);
    const review = screen.getByRole("link", {
      name: "Lihat pembahasan 1 soal",
    });
    expect(review.getAttribute("href")).toBe("#pembahasan");
    const home = screen.getByRole("link", { name: "Ke Belajar" });
    expect(home.getAttribute("href")).toBe("/belajar");
  });

  it("renders the focusable review heading and the S3-01 items", () => {
    render(<FinalQuizResult data={finalDto()} />);
    const heading = screen.getByRole("heading", {
      name: "Pembahasan lengkap",
    });
    expect(heading.id).toBe("pembahasan");
    expect(heading.getAttribute("tabIndex")).toBe("-1");
    expect(screen.getByRole("article")).toBeTruthy();
    expect(screen.getByText("Soal 1")).toBeTruthy();
    expect(screen.getByText("Karena opsi B memang benar.")).toBeTruthy();
  });

  it("hidden policy: “Lihat jawaban Anda”, neutral pills, the intro sentence", () => {
    render(
      <FinalQuizResult
        data={finalDto({
          reviewAccess: "HIDDEN_NOT_PASSED",
          isPassed: false,
          items: [
            item({
              options: [
                { label: "A", text: "Opsi A", selected: false, correct: null },
                { label: "B", text: "Opsi B", selected: true, correct: null },
              ],
              explanation: null,
            }),
          ],
        })}
      />,
    );
    // The jump link swaps its label; the anchor id stays so it still lands.
    const link = screen.getByRole("link", { name: "Lihat jawaban Anda" });
    expect(link.getAttribute("href")).toBe("#pembahasan");
    expect(
      screen.queryByRole("link", { name: /Lihat pembahasan/ }),
    ).toBeNull();
    const heading = screen.getByRole("heading", { name: "Jawaban Anda" });
    expect(heading.id).toBe("pembahasan");
    expect(
      screen.getByText(
        "Kunci jawaban dan pembahasan hanya ditampilkan bila nilai lulus.",
      ),
    ).toBeTruthy();
    const article = screen.getByRole("article");
    expect(within(article).getByText("Dijawab")).toBeTruthy();
    expect(within(article).queryByText("Benar")).toBeNull();
    expect(within(article).queryByText("Salah")).toBeNull();
    expect(within(article).queryByText(/^Kunci:/)).toBeNull();
  });
});
