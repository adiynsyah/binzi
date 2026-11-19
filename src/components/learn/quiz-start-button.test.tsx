// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { QuizStartButton } from "./quiz-start-button";
import type { OpenQuizDTO } from "@/modules/progress/service";

// Card S3-01 §3 — the QZ-18 confirmation dialog (trigger, full copy, link
// to the rules page, Esc → focus back on the trigger — pelajaran 8 Nov
// no. 7) and the C-08 soft-disabled video-gated variant.

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

function quizDto(overrides: Partial<OpenQuizDTO> = {}): OpenQuizDTO {
  return {
    state: "belum",
    eligible: true,
    title: "Quiz Asam Folat",
    questionCount: 5,
    durationMinutes: 10,
    href: "/belajar/gizi-seimbang/asam-folat/quiz",
    ...overrides,
  };
}

describe("QuizStartButton — eligible (dialog)", () => {
  it("opens the QZ-18 dialog from the trigger with the full copy", () => {
    render(<QuizStartButton quiz={quizDto()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Tandai selesai & mulai quiz" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Quiz: Quiz Asam Folat" });
    expect(within(dialog).getByText("5 soal")).toBeTruthy();
    expect(within(dialog).getByText("Waktu 10 menit")).toBeTruthy();
    expect(
      within(dialog).getByText("Hanya dapat dikerjakan SATU KALI"),
    ).toBeTruthy();
    expect(
      within(dialog).getByText("Timer berjalan terus meski halaman ditutup"),
    ).toBeTruthy();
    expect(within(dialog).getByText("Nilai akan tercatat permanen")).toBeTruthy();
    expect(
      within(dialog).getByText("Pastikan koneksi stabil dan Anda siap."),
    ).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Nanti saja" })).toBeTruthy();

    const proceed = within(dialog).getByRole("link", {
      name: "Lanjut ke aturan quiz",
    });
    expect(proceed.getAttribute("href")).toBe(
      "/belajar/gizi-seimbang/asam-folat/quiz",
    );
  });

  it("Esc closes the dialog and returns focus to the trigger (pelajaran 8 Nov no. 7)", async () => {
    render(<QuizStartButton quiz={quizDto()} />);
    const trigger = screen.getByRole("button", {
      name: "Tandai selesai & mulai quiz",
    });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

describe("QuizStartButton — not eligible (video gate)", () => {
  it("soft-disables the button and links the watch-more line via aria-describedby", () => {
    render(<QuizStartButton quiz={quizDto({ eligible: false })} />);

    const button = screen.getByRole("button", {
      name: "Tandai selesai & mulai quiz",
    });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(
      "Tonton video sampai minimal 90 % untuk membuka quiz.",
    );
  });

  it("clicking the locked variant opens NO dialog", () => {
    render(<QuizStartButton quiz={quizDto({ eligible: false })} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Tandai selesai & mulai quiz" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
